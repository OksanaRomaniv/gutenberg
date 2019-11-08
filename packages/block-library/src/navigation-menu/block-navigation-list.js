/**
 * WordPress dependencies
 */
import {
	__experimentalBlockNavigationList,
} from '@wordpress/block-editor';
import { NavigableMenu } from '@wordpress/components';
import {
	useSelect,
	useDispatch,
} from '@wordpress/data';

export default function BlockNavigationList( { clientId } ) {
	const {
		block,
		selectedBlockClientId,
	} = useSelect( ( select ) => {
		const {
			getSelectedBlockClientId,
			getBlock,
		} = select( 'core/block-editor' );

		return {
			block: getBlock( clientId ),
			selectedBlockClientId: getSelectedBlockClientId(),
		};
	}, [ clientId ] );

	const {
		selectBlock,
	} = useDispatch( 'core/block-editor' );

	return (
		<NavigableMenu
			role="presentation"
			className="editor-block-navigation__container block-editor-block-navigation__container"
		>
			<__experimentalBlockNavigationList
				blocks={ [ block ] }
				selectedBlockClientId={ selectedBlockClientId }
				selectBlock={ selectBlock }
				showNestedBlocks
				showAppender
				showBlockMovers
			/>
		</NavigableMenu>
	);
}
