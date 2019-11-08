/**
 * External dependencies
 */
import { map } from 'lodash';
import classnames from 'classnames';

/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { getBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import { create, getTextContent } from '@wordpress/rich-text';

/**
 * Internal dependencies
 */
import BlockIcon from '../block-icon';
import ButtonBlockAppender from '../button-block-appender';
import BlockMover from '../block-mover';

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

function NavigationItem( { block, onSelect, isSelected, hasBlockMovers } ) {
	const [ isHovered, setIsHovered ] = useState( false );
	const [ isSelectionButtonFocused, setIsSelectionButtonFocused ] = useState( false );
	const {
		name,
		clientId,
		attributes,
	} = block;
	const blockType = getBlockType( name );
	const blockDisplayName = getBlockDisplayName( blockType, attributes );

	return (
		// eslint-disable-next-line jsx-a11y/mouse-events-have-key-events
		<div
			className={ classnames( 'editor-block-navigation__item block-editor-block-navigation__item', {
				'is-selected': isSelected,
			} ) }
			onMouseEnter={ () => setIsHovered( true ) }
			onMouseLeave={ () => setIsHovered( false ) }
		>
			<Button
				className="editor-block-navigation__item-button block-editor-block-navigation__item-button"
				onClick={ onSelect }
				onFocus={ () => setIsSelectionButtonFocused( true ) }
				onBlur={ () => setIsSelectionButtonFocused( false ) }
			>
				<BlockIcon icon={ blockType.icon } showColors />
				{ blockDisplayName }
				{ isSelected && <span className="screen-reader-text">{ __( '(selected block)' ) }</span> }
			</Button>
			{ hasBlockMovers && (
				<BlockMover
					isHidden={ ! isHovered && ! isSelected && ! isSelectionButtonFocused }
					clientIds={ [ clientId ] }
				/>
			) }
		</div>
	);
}

export default function BlockNavigationList( {
	blocks,
	selectedBlockClientId,
	selectBlock,
	showAppender,

	// Internal use only.
	showNestedBlocks,
	showBlockMovers,
	parentBlockClientId,
	isRootItem = true,
} ) {
	const shouldShowAppender = showAppender && !! parentBlockClientId;
	const hasBlockMovers = showBlockMovers && blocks.length > 1;

	return (
		/*
		 * Disable reason: The `list` ARIA role is redundant but
		 * Safari+VoiceOver won't announce the list otherwise.
		 */
		/* eslint-disable jsx-a11y/no-redundant-roles */
		<ul className="editor-block-navigation__list block-editor-block-navigation__list" role={ isRootItem ? 'tree' : 'group' }>
			{ map( blocks, ( block ) => {
				const {
					clientId,
					innerBlocks,
				} = block;

				const isSelected = clientId === selectedBlockClientId;

				return (
					<li key={ clientId } role="treeitem">
						<NavigationItem
							block={ block }
							onSelect={ () => selectBlock( clientId ) }
							isSelected={ isSelected }
							hasBlockMovers={ hasBlockMovers }
						/>
						{ showNestedBlocks && !! innerBlocks && !! innerBlocks.length && (
							<BlockNavigationList
								blocks={ innerBlocks }
								selectedBlockClientId={ selectedBlockClientId }
								selectBlock={ selectBlock }
								parentBlockClientId={ clientId }
								showAppender={ showAppender }
								showBlockMovers={ showBlockMovers }
								showNestedBlocks
								isRootItem={ false }
							/>
						) }
					</li>
				);
			} ) }
			{ shouldShowAppender && (
				<li>
					<div className="editor-block-navigation__item block-editor-block-navigation__item">
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
