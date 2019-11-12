/**
 * External dependencies
 */
import { findLast, invert, mapValues, sortBy, throttle } from 'lodash';
import classnames from 'classnames';
import { WidthProvider, Responsive } from 'react-grid-layout';

/**
 * WordPress dependencies
 */
import { Component } from '@wordpress/element';
import { withSelect, withDispatch, AsyncModeProvider } from '@wordpress/data';
import { compose } from '@wordpress/compose';

/**
 * Internal dependencies
 */
import BlockAsyncModeProvider from './block-async-mode-provider';
import BlockListBlock from './block';
import BlockListAppender from '../block-list-appender';
import { getBlockDOMNode } from '../../utils/dom';
import ButtonBlockAppender from '../inner-blocks/button-block-appender';

const ResponsiveGridLayout = WidthProvider( Responsive );

/**
 * If the block count exceeds the threshold, we disable the reordering animation
 * to avoid laginess.
 */
const BLOCK_ANIMATION_THRESHOLD = 200;

const forceSyncUpdates = ( WrappedComponent ) => ( props ) => {
	return (
		<AsyncModeProvider value={ false }>
			<WrappedComponent { ...props } />
		</AsyncModeProvider>
	);
};

class BlockList extends Component {
	constructor( props ) {
		super( props );

		this.onSelectionStart = this.onSelectionStart.bind( this );
		this.onSelectionEnd = this.onSelectionEnd.bind( this );
		this.setBlockRef = this.setBlockRef.bind( this );
		this.setLastClientY = this.setLastClientY.bind( this );
		this.onPointerMove = throttle( this.onPointerMove.bind( this ), 100 );
		// Browser does not fire `*move` event when the pointer position changes
		// relative to the document, so fire it with the last known position.
		this.onScroll = () => this.onPointerMove( { clientY: this.lastClientY } );

		this.lastClientY = 0;
		this.nodes = {};
		this.state = {
			lastClickedBlockAppenderId: null,
			layouts: {
				xs: [ ...new Array( 12 ) ].map( ( n, i ) => ( {
					i: `block-appender-${ i }`,
					x: i % 4,
					y: Math.floor( i / 4 ),
					w: 1,
					h: 1,
				} ) ),
			},
		};
	}

	componentDidMount() {
		window.addEventListener( 'mousemove', this.setLastClientY );
	}

	componentDidUpdate( prevProps ) {
		const { blockClientIds } = this.props;
		let nextState = this.state;

		if (
			blockClientIds.length &&
			! prevProps.blockClientIds.includes(
				blockClientIds[ blockClientIds.length - 1 ]
			)
		) {
			const appenderItem = nextState.layouts.xs.find(
				( item ) => item.i === nextState.lastClickedBlockAppenderId
			);
			nextState = {
				layouts: {
					...nextState.layouts,
					xs: nextState.layouts.xs
						.map( ( item ) => {
							switch ( item.i ) {
								case nextState.lastClickedBlockAppenderId:
									return {
										...appenderItem,
										i: `block-${ blockClientIds[ blockClientIds.length - 1 ] }`,
									};
								case blockClientIds[ blockClientIds.length - 1 ]:
									return null;
								default:
									return item;
							}
						} )
						.filter( ( item ) => item ),
				},
			};
		}

		const cellChanges = {};
		for ( const node of Object.values( this.nodes ) ) {
			const foundItem = nextState.layouts.xs.find( ( item ) => item.i === node.id );
			if ( ! foundItem ) {
				continue;
			}

			const { clientWidth, clientHeight } = node.parentNode;
			const minCols = Math.ceil( node.offsetWidth / ( clientWidth / foundItem.w ) );
			const minRows = Math.ceil( node.offsetHeight / ( clientHeight / foundItem.h ) );
			if ( ( foundItem.w < minCols || foundItem.h < minRows ) ) {
				cellChanges[ node.id ] = {
					w: Math.max( foundItem.w, minCols ),
					h: Math.max( foundItem.h, minRows ),
				};
			}
		}
		if ( Object.keys( cellChanges ).length ) {
			nextState = {
				layouts: {
					...nextState.layouts,
					xs: nextState.layouts.xs.map( ( item ) =>
						cellChanges[ item.i ] ? { ...item, ...cellChanges[ item.i ] } : item
					),
				},
			};
		}

		const maxRow = Math.max( 2, ...nextState.layouts.xs.filter( ( item ) => ! item.i.startsWith( 'block-appender' ) ).map( ( item ) => item.y + item.h - 1 ) );
		if ( nextState.layouts.xs.some( ( item ) => item.y > maxRow ) ) {
			nextState = {
				layouts: {
					...nextState.layouts,
					xs: nextState.layouts.xs.filter( ( item ) => item.y <= maxRow ),
				},
			};
		}

		const emptyCells = {};
		for (
			let col = 0;
			col <= Math.max( ...nextState.layouts.xs.map( ( item ) => item.x + item.w - 1 ) );
			col++
		) {
			for (
				let row = 0;
				row <= maxRow;
				row++
			) {
				emptyCells[ `${ col } | ${ row }` ] = true;
			}
		}
		for ( const item of nextState.layouts.xs ) {
			for ( let col = item.x; col < item.x + item.w; col++ ) {
				for ( let row = item.y; row < item.y + item.h; row++ ) {
					delete emptyCells[ `${ col } | ${ row }` ];
				}
			}
		}
		if ( Object.keys( emptyCells ).length ) {
			nextState = {
				layouts: {
					...nextState.layouts,
					xs: [
						...nextState.layouts.xs,
						...Object.keys( emptyCells ).map( ( emptyCell, i ) => {
							const [ col, row ] = emptyCell.split( ' | ' );
							return {
								i: `block-appender-${ col } | ${ row }`,
								x: Number( col ),
								y: Number( row ),
								w: 1,
								h: 1,
							};
						} ),
					],
				},
			};
		}

		if ( this.state !== nextState ) {
			this.setState( nextState );
		}
	}

	componentWillUnmount() {
		window.removeEventListener( 'mousemove', this.setLastClientY );
	}

	setLastClientY( { clientY } ) {
		this.lastClientY = clientY;
	}

	setBlockRef( node, clientId ) {
		if ( node === null ) {
			delete this.nodes[ clientId ];
		} else {
			this.nodes = {
				...this.nodes,
				[ clientId ]: node,
			};
		}
	}

	/**
	 * Handles a pointer move event to update the extent of the current cursor
	 * multi-selection.
	 *
	 * @param {MouseEvent} event A mousemove event object.
	 */
	onPointerMove( { clientY } ) {
		// We don't start multi-selection until the mouse starts moving, so as
		// to avoid dispatching multi-selection actions on an in-place click.
		if ( ! this.props.isMultiSelecting ) {
			this.props.onStartMultiSelect();
		}

		const blockContentBoundaries = getBlockDOMNode(
			this.selectionAtStart
		).getBoundingClientRect();

		// prevent multi-selection from triggering when the selected block is a float
		// and the cursor is still between the top and the bottom of the block.
		if (
			clientY >= blockContentBoundaries.top &&
			clientY <= blockContentBoundaries.bottom
		) {
			return;
		}

		const y = clientY - blockContentBoundaries.top;
		const key = findLast( this.coordMapKeys, ( coordY ) => coordY < y );

		this.onSelectionChange( this.coordMap[ key ] );
	}

	/**
	 * Binds event handlers to the document for tracking a pending multi-select
	 * in response to a mousedown event occurring in a rendered block.
	 *
	 * @param {string} clientId Client ID of block where mousedown occurred.
	 */
	onSelectionStart( clientId ) {
		if ( ! this.props.isSelectionEnabled ) {
			return;
		}

		const boundaries = this.nodes[ clientId ].getBoundingClientRect();

		// Create a clientId to Y coördinate map.
		const clientIdToCoordMap = mapValues(
			this.nodes,
			( node ) => node.getBoundingClientRect().top - boundaries.top
		);

		// Cache a Y coördinate to clientId map for use in `onPointerMove`.
		this.coordMap = invert( clientIdToCoordMap );
		// Cache an array of the Y coördinates for use in `onPointerMove`.
		// Sort the coördinates, as `this.nodes` will not necessarily reflect
		// the current block sequence.
		this.coordMapKeys = sortBy( Object.values( clientIdToCoordMap ) );
		this.selectionAtStart = clientId;

		window.addEventListener( 'mousemove', this.onPointerMove );
		// Capture scroll on all elements.
		window.addEventListener( 'scroll', this.onScroll, true );
		window.addEventListener( 'mouseup', this.onSelectionEnd );
	}

	/**
	 * Handles multi-selection changes in response to pointer move.
	 *
	 * @param {string} clientId Client ID of block under cursor in multi-select
	 *                          drag.
	 */
	onSelectionChange( clientId ) {
		const { onMultiSelect, selectionStart, selectionEnd } = this.props;
		const { selectionAtStart } = this;
		const isAtStart = selectionAtStart === clientId;

		if ( ! selectionAtStart || ! this.props.isSelectionEnabled ) {
			return;
		}

		// If multi-selecting and cursor extent returns to the start of
		// selection, cancel multi-select.
		if ( isAtStart && selectionStart ) {
			onMultiSelect( null, null );
		}

		// Expand multi-selection to block under cursor.
		if ( ! isAtStart && selectionEnd !== clientId ) {
			onMultiSelect( selectionAtStart, clientId );
		}
	}

	/**
	 * Handles a mouseup event to end the current cursor multi-selection.
	 */
	onSelectionEnd() {
		// Cancel throttled calls.
		this.onPointerMove.cancel();

		delete this.coordMap;
		delete this.coordMapKeys;
		delete this.selectionAtStart;

		window.removeEventListener( 'mousemove', this.onPointerMove );
		window.removeEventListener( 'scroll', this.onScroll, true );
		window.removeEventListener( 'mouseup', this.onSelectionEnd );

		// We may or may not be in a multi-selection when mouseup occurs (e.g.
		// an in-place mouse click), so only trigger stop if multi-selecting.
		if ( this.props.isMultiSelecting ) {
			this.props.onStopMultiSelect();
		}
	}

	render() {
		const {
			className,
			blockClientIds,
			rootClientId,
			__experimentalMoverDirection: moverDirection = 'vertical',
			isDraggable,
			selectedBlockClientId,
			multiSelectedBlockClientIds,
			hasMultiSelection,
			renderAppender,
			enableAnimation,
		} = this.props;

		return (
			<div
				className={ classnames(
					'editor-block-list__layout block-editor-block-list__layout block-editor-block-list__grid',
					className
				) }
			>
				<ResponsiveGridLayout
					compactType="vertical"
					draggableCancel='input,textarea,[contenteditable=""],[contenteditable="true"]'
					layouts={ this.state.layouts }
					margin={ [ 0, 0 ] }
					onLayoutChange={ ( layout, layouts ) => {
						console.log( layout, layouts );
						this.setState( { layouts } );
					} }
				>
					{ [
						...this.state.layouts.xs
							.filter( ( item ) => item.i.startsWith( 'block-appender' ) )
							.map( ( item ) => (
								<div
									key={ item.i }
									id={ item.i }
									onClick={ ( { currentTarget: { id } } ) =>
										this.setState( { lastClickedBlockAppenderId: id } )
									}
								>
									<BlockListAppender
										rootClientId={ rootClientId }
										renderAppender={ renderAppender || ButtonBlockAppender }
									/>
								</div>
							) ),
						...blockClientIds.map( ( clientId ) => {
							const isBlockInSelection = hasMultiSelection ?
								multiSelectedBlockClientIds.includes( clientId ) :
								selectedBlockClientId === clientId;

							return (
								<div key={ 'block-' + clientId } style={ { padding: '0 20px' } }>
									<BlockAsyncModeProvider
										key={ 'block-' + clientId }
										clientId={ clientId }
										isBlockInSelection={ isBlockInSelection }
									>
										<BlockListBlock
											rootClientId={ rootClientId }
											clientId={ clientId }
											blockRef={ this.setBlockRef }
											onSelectionStart={ this.onSelectionStart }
											isLocked
										/>
									</BlockAsyncModeProvider>
								</div>
							);
						} ),
					] }
				</ResponsiveGridLayout>
			</div>
		);
	}
}

export default compose( [
	// This component needs to always be synchronous
	// as it's the one changing the async mode
	// depending on the block selection.
	forceSyncUpdates,
	withSelect( ( select, ownProps ) => {
		const {
			getBlockOrder,
			isSelectionEnabled,
			isMultiSelecting,
			getMultiSelectedBlocksStartClientId,
			getMultiSelectedBlocksEndClientId,
			getSelectedBlockClientId,
			getMultiSelectedBlockClientIds,
			hasMultiSelection,
			getGlobalBlockCount,
			isTyping,
		} = select( 'core/block-editor' );

		const { rootClientId } = ownProps;

		return {
			blockClientIds: getBlockOrder( rootClientId ),
			selectionStart: getMultiSelectedBlocksStartClientId(),
			selectionEnd: getMultiSelectedBlocksEndClientId(),
			isSelectionEnabled: isSelectionEnabled(),
			isMultiSelecting: isMultiSelecting(),
			selectedBlockClientId: getSelectedBlockClientId(),
			multiSelectedBlockClientIds: getMultiSelectedBlockClientIds(),
			hasMultiSelection: hasMultiSelection(),
			enableAnimation:
				! isTyping() && getGlobalBlockCount() <= BLOCK_ANIMATION_THRESHOLD,
			isTyping,
		};
	} ),
	withDispatch( ( dispatch ) => {
		const { startMultiSelect, stopMultiSelect, multiSelect } = dispatch(
			'core/block-editor'
		);

		return {
			onStartMultiSelect: startMultiSelect,
			onStopMultiSelect: stopMultiSelect,
			onMultiSelect: multiSelect,
		};
	} ),
] )( BlockList );
