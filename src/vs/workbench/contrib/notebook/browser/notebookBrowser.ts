/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMouseWheelEvent } from 'vs/base/browser/mouseEvent';
import { IListEvent, IListMouseEvent } from 'vs/base/browser/ui/list/list';
import { IListOptions, IListStyles } from 'vs/base/browser/ui/list/listWidget';
import { ProgressBar } from 'vs/base/browser/ui/progressbar/progressbar';
import { ToolBar } from 'vs/base/browser/ui/toolbar/toolbar';
import { CancellationTokenSource } from 'vs/base/common/cancellation';
import { Event } from 'vs/base/common/event';
import { DisposableStore, IDisposable } from 'vs/base/common/lifecycle';
import { ScrollEvent } from 'vs/base/common/scrollable';
import { URI } from 'vs/base/common/uri';
import { CodeEditorWidget } from 'vs/editor/browser/widget/codeEditorWidget';
import { BareFontInfo } from 'vs/editor/common/config/fontInfo';
import { Range } from 'vs/editor/common/core/range';
import { FindMatch } from 'vs/editor/common/model';
import { RawContextKey } from 'vs/platform/contextkey/common/contextkey';
import { NOTEBOOK_EDITABLE_CONTEXT_KEY, NOTEBOOK_EXECUTING_KEY } from 'vs/workbench/contrib/notebook/browser/constants';
import { OutputRenderer } from 'vs/workbench/contrib/notebook/browser/view/output/outputRenderer';
import { CellViewModel, IModelDecorationsChangeAccessor, NotebookViewModel } from 'vs/workbench/contrib/notebook/browser/viewModel/notebookViewModel';
import { NotebookCellTextModel } from 'vs/workbench/contrib/notebook/common/model/notebookCellTextModel';
import { CellKind, IOutput, IRenderOutput, NotebookCellMetadata, NotebookDocumentMetadata } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { Webview } from 'vs/workbench/contrib/webview/browser/webview';

export const KEYBINDING_CONTEXT_NOTEBOOK_FIND_WIDGET_FOCUSED = new RawContextKey<boolean>('notebookFindWidgetFocused', false);

export const NOTEBOOK_EDITOR_FOCUSED = new RawContextKey<boolean>('notebookEditorFocused', false);
export const NOTEBOOK_EDITOR_EDITABLE = new RawContextKey<boolean>(NOTEBOOK_EDITABLE_CONTEXT_KEY, true);
export const NOTEBOOK_EDITOR_EXECUTING_NOTEBOOK = new RawContextKey<boolean>(NOTEBOOK_EXECUTING_KEY, false);

export interface NotebookLayoutInfo {
	width: number;
	height: number;
	fontInfo: BareFontInfo;
}

export interface NotebookLayoutChangeEvent {
	width?: boolean;
	height?: boolean;
	fontInfo?: boolean;
}

export interface CodeCellLayoutInfo {
	readonly fontInfo: BareFontInfo | null;
	readonly editorHeight: number;
	readonly editorWidth: number;
	readonly totalHeight: number;
	readonly outputContainerOffset: number;
	readonly outputTotalHeight: number;
	readonly indicatorHeight: number;
	readonly bottomToolbarOffset: number;
}

export interface CodeCellLayoutChangeEvent {
	editorHeight?: boolean;
	outputHeight?: boolean;
	totalHeight?: boolean;
	outerWidth?: number;
	font?: BareFontInfo;
}

export interface MarkdownCellLayoutInfo {
	readonly fontInfo: BareFontInfo | null;
	readonly editorWidth: number;
	readonly bottomToolbarOffset: number;
	readonly totalHeight: number;
}

export interface MarkdownCellLayoutChangeEvent {
	font?: BareFontInfo;
	outerWidth?: number;
	totalHeight?: number;
}

export interface ICellViewModel {
	readonly model: NotebookCellTextModel;
	readonly id: string;
	dragging: boolean;
	handle: number;
	uri: URI;
	cellKind: CellKind;
	editState: CellEditState;
	readonly runState: CellRunState;
	currentTokenSource: CancellationTokenSource | undefined;
	focusMode: CellFocusMode;
	getText(): string;
	metadata: NotebookCellMetadata | undefined;
	getEvaluatedMetadata(documentMetadata: NotebookDocumentMetadata | undefined): NotebookCellMetadata;
}

export interface INotebookEditorMouseEvent {
	readonly event: MouseEvent;
	readonly target: CellViewModel;
}

export interface INotebookEditor {

	/**
	 * Notebook view model attached to the current editor
	 */
	viewModel: NotebookViewModel | undefined;

	isNotebookEditor: boolean;

	getInnerWebview(): Webview | undefined;

	/**
	 * Focus the notebook editor cell list
	 */
	focus(): void;

	/**
	 * Select & focus cell
	 */
	selectElement(cell: ICellViewModel): void;

	/**
	 * Layout info for the notebook editor
	 */
	getLayoutInfo(): NotebookLayoutInfo;
	/**
	 * Fetch the output renderers for notebook outputs.
	 */
	getOutputRenderer(): OutputRenderer;

	/**
	 * Insert a new cell around `cell`
	 */
	insertNotebookCell(cell: ICellViewModel, type: CellKind, direction: 'above' | 'below', initialText?: string): Promise<void>;

	/**
	 * Delete a cell from the notebook
	 */
	deleteNotebookCell(cell: ICellViewModel): void;

	/**
	 * Move a cell up one spot
	 */
	moveCellUp(cell: ICellViewModel): void;

	/**
	 * Move a cell down one spot
	 */
	moveCellDown(cell: ICellViewModel): void;

	/**
	 * Move a cell above or below another cell
	 */
	moveCell(cell: ICellViewModel, relativeToCell: ICellViewModel, direction: 'above' | 'below'): Promise<void>;

	/**
	 * Switch the cell into editing mode.
	 *
	 * For code cell, the monaco editor will be focused.
	 * For markdown cell, it will switch from preview mode to editing mode, which focuses the monaco editor.
	 */
	editNotebookCell(cell: ICellViewModel): void;

	/**
	 * Quit cell editing mode.
	 */
	saveNotebookCell(cell: ICellViewModel): void;

	/**
	 * Focus the container of a cell (the monaco editor inside is not focused).
	 */
	focusNotebookCell(cell: ICellViewModel, focusEditor: boolean): void;

	/**
	 * Execute the given notebook cell
	 */
	executeNotebookCell(cell: ICellViewModel): Promise<void>;

	/**
	 * Cancel the cell execution
	 */
	cancelNotebookCellExecution(cell: ICellViewModel): void;

	/**
	 * Executes all notebook cells in order
	 */
	executeNotebook(): Promise<void>;

	/**
	 * Cancel the notebook execution
	 */
	cancelNotebookExecution(): void;

	/**
	 * Get current active cell
	 */
	getActiveCell(): ICellViewModel | undefined;

	/**
	 * Layout the cell with a new height
	 */
	layoutNotebookCell(cell: ICellViewModel, height: number): Promise<void>;

	/**
	 * Render the output in webview layer
	 */
	createInset(cell: ICellViewModel, output: IOutput, shadowContent: string, offset: number): void;

	/**
	 * Remove the output from the webview layer
	 */
	removeInset(output: IOutput): void;

	/**
	 * Send message to the webview for outputs.
	 */
	postMessage(message: any): void;

	/**
	 * Trigger the editor to scroll from scroll event programmatically
	 */
	triggerScroll(event: IMouseWheelEvent): void;

	/**
	 * Reveal cell into viewport.
	 */
	revealInView(cell: ICellViewModel): void;

	/**
	 * Reveal cell into viewport center.
	 */
	revealInCenter(cell: ICellViewModel): void;

	/**
	 * Reveal cell into viewport center if cell is currently out of the viewport.
	 */
	revealInCenterIfOutsideViewport(cell: ICellViewModel): void;

	/**
	 * Reveal a line in notebook cell into viewport with minimal scrolling.
	 */
	revealLineInView(cell: ICellViewModel, line: number): void;

	/**
	 * Reveal a line in notebook cell into viewport center.
	 */
	revealLineInCenter(cell: ICellViewModel, line: number): void;

	/**
	 * Reveal a line in notebook cell into viewport center.
	 */
	revealLineInCenterIfOutsideViewport(cell: ICellViewModel, line: number): void;

	/**
	 * Reveal a range in notebook cell into viewport with minimal scrolling.
	 */
	revealRangeInView(cell: ICellViewModel, range: Range): void;

	/**
	 * Reveal a range in notebook cell into viewport center.
	 */
	revealRangeInCenter(cell: ICellViewModel, range: Range): void;

	/**
	 * Reveal a range in notebook cell into viewport center.
	 */
	revealRangeInCenterIfOutsideViewport(cell: ICellViewModel, range: Range): void;

	/**
	 * Set hidden areas on cell text models.
	 */
	setHiddenAreas(_ranges: ICellRange[]): boolean;

	setCellSelection(cell: ICellViewModel, selection: Range): void;

	/**
	 * Change the decorations on cells.
	 * The notebook is virtualized and this method should be called to create/delete editor decorations safely.
	 */
	changeDecorations(callback: (changeAccessor: IModelDecorationsChangeAccessor) => any): any;

	/**
	 * Show Find Widget.
	 *
	 * Currently Find is still part of the NotebookEditor core
	 */
	showFind(): void;

	/**
	 * Hide Find Widget
	 */
	hideFind(): void;

	/**
	 * An event emitted on a "mouseup".
	 * @event
	 */
	onMouseUp(listener: (e: INotebookEditorMouseEvent) => void): IDisposable;

	/**
	 * An event emitted on a "mousedown".
	 * @event
	 */
	onMouseDown(listener: (e: INotebookEditorMouseEvent) => void): IDisposable;
}

export interface INotebookCellList {
	onWillScroll: Event<ScrollEvent>;
	onDidChangeFocus: Event<IListEvent<ICellViewModel>>;
	onDidChangeContentHeight: Event<number>;
	scrollTop: number;
	scrollHeight: number;
	scrollLeft: number;
	length: number;
	rowsContainer: HTMLElement;
	readonly onDidRemoveOutput: Event<IOutput>;
	readonly onMouseUp: Event<IListMouseEvent<CellViewModel>>;
	readonly onMouseDown: Event<IListMouseEvent<CellViewModel>>;
	detachViewModel(): void;
	attachViewModel(viewModel: NotebookViewModel): void;
	clear(): void;
	focusElement(element: ICellViewModel): void;
	selectElement(element: ICellViewModel): void;
	getFocusedElements(): ICellViewModel[];
	revealElementInView(element: ICellViewModel): void;
	revealElementInCenterIfOutsideViewport(element: ICellViewModel): void;
	revealElementInCenter(element: ICellViewModel): void;
	revealElementLineInView(element: ICellViewModel, line: number): void;
	revealElementLineInCenter(element: ICellViewModel, line: number): void;
	revealElementLineInCenterIfOutsideViewport(element: ICellViewModel, line: number): void;
	revealElementRangeInView(element: ICellViewModel, range: Range): void;
	revealElementRangeInCenter(element: ICellViewModel, range: Range): void;
	revealElementRangeInCenterIfOutsideViewport(element: ICellViewModel, range: Range): void;
	setHiddenAreas(_ranges: ICellRange[]): boolean;
	domElementOfElement(element: ICellViewModel): HTMLElement | null;
	focusView(): void;
	getAbsoluteTopOfElement(element: ICellViewModel): number;
	triggerScrollFromMouseWheelEvent(browserEvent: IMouseWheelEvent): void;
	updateElementHeight2(element: ICellViewModel, size: number): void;
	domFocus(): void;
	setCellSelection(element: ICellViewModel, range: Range): void;
	style(styles: IListStyles): void;
	updateOptions(options: IListOptions<ICellViewModel>): void;
	layout(height?: number, width?: number): void;
	dispose(): void;
}

export interface BaseCellRenderTemplate {
	container: HTMLElement;
	cellContainer: HTMLElement;
	dragHandle: HTMLElement;
	toolbar: ToolBar;
	focusIndicator: HTMLElement;
	insertionIndicatorTop: HTMLElement;
	disposables: DisposableStore;
	bottomCellContainer: HTMLElement;
	currentRenderedCell?: ICellViewModel;
	toJSON: () => any;
}

export interface MarkdownCellRenderTemplate extends BaseCellRenderTemplate {
	editingContainer: HTMLElement;
	foldingIndicator: HTMLElement;
}

export interface CodeCellRenderTemplate extends BaseCellRenderTemplate {
	statusBarContainer: HTMLElement;
	cellRunStatusContainer: HTMLElement;
	cellStatusMessageContainer: HTMLElement;
	cellStatusPlaceholderContainer: HTMLElement;
	runToolbar: ToolBar;
	runButtonContainer: HTMLElement;
	executionOrderLabel: HTMLElement;
	outputContainer: HTMLElement;
	editor: CodeEditorWidget;
	progressBar: ProgressBar;
}

export interface IOutputTransformContribution {
	/**
	 * Dispose this contribution.
	 */
	dispose(): void;

	render(output: IOutput, container: HTMLElement, preferredMimeType: string | undefined): IRenderOutput;
}

export interface CellFindMatch {
	cell: CellViewModel;
	matches: FindMatch[];
}

export enum CellRevealType {
	Line,
	Range
}

export enum CellRevealPosition {
	Top,
	Center
}

export enum CellRunState {
	Idle,
	Running
}

export enum CellEditState {
	/**
	 * Default state.
	 * For markdown cell, it's Markdown preview.
	 * For code cell, the browser focus should be on the container instead of the editor
	 */
	Preview,


	/**
	 * Eding mode. Source for markdown or code is rendered in editors and the state will be persistent.
	 */
	Editing
}

export enum CellFocusMode {
	Container,
	Editor
}

export enum CursorAtBoundary {
	None,
	Top,
	Bottom,
	Both
}

export interface CellViewModelStateChangeEvent {
	metadataChanged?: boolean;
	selectionChanged?: boolean;
	focusModeChanged?: boolean;
	runStateChanged?: boolean;
	editStateChanged?: boolean;
	languageChanged?: boolean;
	foldingStateChanged?: boolean;
	contentChanged?: boolean;
}

/**
 * [start, end]
 */
export interface ICellRange {
	/**
	 * zero based index
	 */
	start: number;

	/**
	 * zero based index
	 */
	end: number;
}


/**
 * @param _ranges
 */
export function reduceCellRanges(_ranges: ICellRange[]): ICellRange[] {
	if (!_ranges.length) {
		return [];
	}

	let ranges = _ranges.sort((a, b) => a.start - b.start);
	let result: ICellRange[] = [];
	let currentRangeStart = ranges[0].start;
	let currentRangeEnd = ranges[0].end + 1;

	for (let i = 0, len = ranges.length; i < len; i++) {
		let range = ranges[i];

		if (range.start > currentRangeEnd) {
			result.push({ start: currentRangeStart, end: currentRangeEnd - 1 });
			currentRangeStart = range.start;
			currentRangeEnd = range.end + 1;
		} else if (range.end + 1 > currentRangeEnd) {
			currentRangeEnd = range.end + 1;
		}
	}

	result.push({ start: currentRangeStart, end: currentRangeEnd - 1 });
	return result;
}

export function getVisibleCells(cells: CellViewModel[], hiddenRanges: ICellRange[]) {
	if (!hiddenRanges.length) {
		return cells;
	}

	let start = 0;
	let hiddenRangeIndex = 0;
	let result: any[] = [];

	while (start < cells.length && hiddenRangeIndex < hiddenRanges.length) {
		if (start < hiddenRanges[hiddenRangeIndex].start) {
			result.push(...cells.slice(start, hiddenRanges[hiddenRangeIndex].start));
		}

		start = hiddenRanges[hiddenRangeIndex].end + 1;
		hiddenRangeIndex++;
	}

	if (start < cells.length) {
		result.push(...cells.slice(start));
	}

	return result;
}
