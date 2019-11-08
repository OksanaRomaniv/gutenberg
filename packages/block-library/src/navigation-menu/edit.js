/**
 * External dependencies
 */
import classnames from 'classnames';

/**
 * WordPress dependencies
 */
import {
	useMemo,
	useEffect,
} from '@wordpress/element';
import {
	InnerBlocks,
	InspectorControls,
	BlockControls,
	withColors,
} from '@wordpress/block-editor';
import { withSelect } from '@wordpress/data';
import {
	CheckboxControl,
	PanelBody,
	Spinner,
	Toolbar,
} from '@wordpress/components';
import { compose } from '@wordpress/compose';

import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import useBlockNavigator from './use-block-navigator';
import BlockNavigationList from './block-navigation-list';
import BlockColorsStyleSelector from './block-colors-selector';

function NavigationMenu( {
	attributes,
	clientId,
	pages,
	isRequesting,
	backgroundColor,
	textColor,
	setBackgroundColor,
	setTextColor,
	setAttributes,
} ) {
	const { navigatorToolbarButton, navigatorModal } = useBlockNavigator( clientId );
	const defaultMenuItems = useMemo(
		() => {
			if ( ! pages ) {
				return null;
			}

			return pages.map( ( { title, type, link: url, id } ) => (
				[ 'core/navigation-menu-item', {
					label: title.rendered,
					title: title.raw,
					type,
					id,
					url,
					opensInNewTab: false,
				} ]
			) );
		},
		[ pages ]
	);

	const navigationMenuInlineStyles = {};
	if ( attributes.textColorValue ) {
		navigationMenuInlineStyles.color = attributes.textColorValue;
	}

	const navigationMenuClasses = classnames(
		'wp-block-navigation-menu', {
			'has-text-color': textColor.color,
			[ attributes.textColorCSSClass ]: attributes && attributes.textColorCSSClass,
		}
	);

	useEffect( () => {
		setAttributes( {
			textColorCSSClass: textColor.class ? textColor.class : null,
		} );
	}, [ textColor.class ] );

	return (
		<>
			<BlockControls>
				<Toolbar>
					{ navigatorToolbarButton }
				</Toolbar>
				<BlockColorsStyleSelector
					textColor={ textColor }
					textColorValue={ attributes.textColorValue }
					onColorChange={ ( { value } ) => {
						setTextColor( value );
						setAttributes( { textColorValue: value } );
					} }
				/>
			</BlockControls>
			{ navigatorModal }
			<InspectorControls>
				<PanelBody
					title={ __( 'Menu Settings' ) }
				>
					<CheckboxControl
						value={ attributes.automaticallyAdd }
						onChange={ ( automaticallyAdd ) => setAttributes( { automaticallyAdd } ) }
						label={ __( 'Automatically add new pages' ) }
						help={ __( 'Automatically add new top level pages to this menu.' ) }
					/>
				</PanelBody>
				<PanelBody
					title={ __( 'Navigation Structure' ) }
				>
					<BlockNavigationList clientId={ clientId } />
				</PanelBody>
			</InspectorControls>

			<div className={ navigationMenuClasses } style={ navigationMenuInlineStyles }>
				{ isRequesting && <><Spinner /> { __( 'Loading Navigation…' ) } </> }
				{ pages &&
					<InnerBlocks
						template={ defaultMenuItems ? defaultMenuItems : null }
						allowedBlocks={ [ 'core/navigation-menu-item' ] }
						templateInsertUpdatesSelection={ false }
						__experimentalMoverDirection={ 'horizontal' }
					/>
				}
			</div>
		</>
	);
}

export default compose( [
	withColors( { backgroundColor: 'background-color', textColor: 'color' } ),
	withSelect( ( select ) => {
		const { getEntityRecords } = select( 'core' );
		const { isResolving } = select( 'core/data' );
		const filterDefaultPages = {
			parent: 0,
			order: 'asc',
			orderby: 'id',
		};
		return {
			pages: getEntityRecords( 'postType', 'page', filterDefaultPages ),
			isRequesting: isResolving( 'core', 'getEntityRecords', [ 'postType', 'page', filterDefaultPages ] ),
		};
	} ),
] )( NavigationMenu );
