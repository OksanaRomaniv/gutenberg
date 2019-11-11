/**
 * External dependencies
 */
import { animated } from 'react-spring/web.cjs';
import { map } from 'lodash';
import classnames from 'classnames';

/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { useRef, useState } from '@wordpress/element';
import { getBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import { create, getTextContent } from '@wordpress/rich-text';

/**
 * Internal dependencies
 */
import BlockIcon from '../block-icon';
import ButtonBlockAppender from '../button-block-appender';
import BlockMover from '../block-mover';
import useMovingAnimation from '../use-moving-animation';

/**
 * Get the block display name, if it has one, or the block title if it doesn't.
 *
 * @param {Object} blockType  The block type.
 * @param {Object} attributes The values of the block's attributes
 *
 * @return {string} The display name value.
 */
function getBlockDisplayName( blockType, attributes ) {
	const displayNameAttribute = blockType.__experimentalDisplayName;

	if ( ! displayNameAttribute || ! attributes[ displayNameAttribute ] ) {
		return blockType.title;
	}

	// Strip any formatting.
	const richTextValue = create( { html: attributes[ displayNameAttribute ] } );
	const formatlessDisplayName = getTextContent( richTextValue );

	return formatlessDisplayName;
}

function NavigationList( { blocks, selectBlock, selectedBlockClientId, showAppender, showBlockMovers, showNestedBlocks, parentBlockClientId } ) {
	const isTreeRoot = ! parentBlockClientId;

	return (
		/*
		 * Disable reason: The `list` ARIA role is redundant but
		 * Safari+VoiceOver won't announce the list otherwise.
		 */
		/* eslint-disable jsx-a11y/no-redundant-roles */
		<ul className="editor-block-navigation__list block-editor-block-navigation__list" role={ isTreeRoot ? 'tree' : 'group' }>
			{ map( blocks, ( block, index ) => {
				return (
					<NavigationBlock
						key={ block.clientId }
						block={ block }
						selectBlock={ selectBlock }
						selectedBlockClientId={ selectedBlockClientId }
						position={ index }
						hasSiblings={ blocks.length > 1 }
						showAppender={ showAppender }
						showBlockMovers={ showBlockMovers }
						showNestedBlocks={ showNestedBlocks }
					/>
				);
			} ) }
			{ showAppender && blocks.length > 0 && ! isTreeRoot && (
				<li>
					<div className="editor-block-navigation__item block-editor-block-navigation__item is-appender">
						<ButtonBlockAppender
							rootClientId={ parentBlockClientId }
							__experimentalSelectBlockOnInsert={ false }
						/>
					</div>
				</li>
			) }
		</ul>
		/* eslint-enable jsx-a11y/no-redundant-roles */
	);
}

function NavigationBlock( { block, selectBlock, selectedBlockClientId, position, hasSiblings, showAppender, showBlockMovers, showNestedBlocks } ) {
	const [ isHovered, setIsHovered ] = useState( false );
	const [ isSelectionButtonFocused, setIsSelectionButtonFocused ] = useState( false );
	const {
		name,
		clientId,
		attributes,
		innerBlocks,
	} = block;
	const blockType = getBlockType( name );
	const blockDisplayName = getBlockDisplayName( blockType, attributes );

	const wrapper = useRef( null );
	const isSelected = clientId === selectedBlockClientId;
	const adjustScrolling = false;
	const enableAnimation = true;
	const animateOnChange = position;

	const style = useMovingAnimation( wrapper, isSelected, adjustScrolling, enableAnimation, animateOnChange );

	return (
		<animated.li ref={ wrapper } style={ style } role="treeitem">
			<div
				className={ classnames( 'editor-block-navigation__item block-editor-block-navigation__item', {
					'is-selected': isSelected,
				} ) }
				onMouseEnter={ () => setIsHovered( true ) }
				onMouseLeave={ () => setIsHovered( false ) }
			>
				<Button
					className="editor-block-navigation__item-button block-editor-block-navigation__item-button"
					onClick={ () => selectBlock( clientId ) }
					onFocus={ () => setIsSelectionButtonFocused( true ) }
					onBlur={ () => setIsSelectionButtonFocused( false ) }
				>
					<BlockIcon icon={ blockType.icon } showColors />
					{ blockDisplayName }
					{ isSelected && <span className="screen-reader-text">{ __( '(selected block)' ) }</span> }
				</Button>
				{ showBlockMovers && hasSiblings && (
					<BlockMover
						isHidden={ ! isHovered && ! isSelected && ! isSelectionButtonFocused }
						clientIds={ [ clientId ] }
					/>
				) }
			</div>
			{ showNestedBlocks && !! innerBlocks && !! innerBlocks.length && (
				<NavigationList
					blocks={ innerBlocks }
					selectedBlockClientId={ selectedBlockClientId }
					selectBlock={ selectBlock }
					showAppender={ showAppender }
					showBlockMovers={ showBlockMovers }
					showNestedBlocks={ showNestedBlocks }
					parentBlockClientId={ clientId }
				/>
			) }
		</animated.li>
	);
}

export default function BlockNavigationList( props ) {
	const {
		blocks,
		selectedBlockClientId,
		selectBlock,
		showAppender,
		showBlockMovers,
		showNestedBlocks,
	} = props;

	return (
		<NavigationList
			blocks={ blocks }
			selectedBlockClientId={ selectedBlockClientId }
			selectBlock={ selectBlock }
			showAppender={ showAppender }
			showBlockMovers={ showBlockMovers }
			showNestedBlocks={ showNestedBlocks }
		/>
	);
}
