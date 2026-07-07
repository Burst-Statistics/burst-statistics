/**
 * Burst Statistics — Gutenberg Block Editor Integration
 *
 * Adds a "Burst Goal" control group to both the Block Toolbar and the
 * Block Inspector panel for core/button, core/image, and core/navigation-link.
 *
 * attributes:
 *   - burstGoalUid    (string): Unique selector UID (e.g. burst-xxxxxxxx).
 *   - burstGoalActive (boolean): True when the goal is currently active.
 *   - burstGoalId     (number): Database ID of the goal.
 *
 * central source of truth:
 *   - The goals data list is localized on mount/load from the PHP database.
 *   - The block pulls its current settings (title, metric, scope) from the DB.
 *   - On toggling/saving, fields are persisted to the database and the client state is synced.
 */
( function () {
	'use strict';

	const { addFilter }                                                    = wp.hooks;
	const { createHigherOrderComponent }                                   = wp.compose;
	const { InspectorControls, BlockControls }                             = wp.blockEditor;
	const { PanelBody, ToggleControl, TextControl, SelectControl, Notice, ToolbarGroup, ToolbarButton, Modal, Button } = wp.components;
	const { createElement: el, Fragment, useState, useEffect }             = wp.element;
	const { __, sprintf }                                                  = wp.i18n;
	const apiFetch                                                         = wp.apiFetch;

	// ------------------------------------------------------------------
	// Settings passed from PHP via wp_localize_script( 'burstBlockEditor' ).
	// ------------------------------------------------------------------
	const settings = window.burstBlockEditor || {};

	const REST_URL        = ( settings.rest_url || '' ).replace( /\/$/, '' );
	const NONCE           = settings.nonce || '';
	const BURST_NONCE     = settings.burst_nonce || '';
	const USER_CAN_MANAGE = String( settings.user_can_manage ) === '1' || settings.user_can_manage === true || String( settings.user_can_manage ) === 'true';
	// goal_count is only used as the initial seed; actual count is derived from active_block_goal_uids.
	const INITIAL_GOAL_COUNT = parseInt( settings.goal_count, 10 ) || 0;
	const GOAL_LIMIT      = parseInt( settings.goal_limit, 10 );   // -1 = unlimited (Pro)
	const IS_PRO          = String( settings.is_pro ) === '1' || settings.is_pro === true || String( settings.is_pro ) === 'true';

	const ALLOWED_BLOCKS  = [ 'core/button', 'core/image', 'core/navigation-link' ];

	let activeGoalCount = INITIAL_GOAL_COUNT;

	// ------------------------------------------------------------------
	// Helpers
	// ------------------------------------------------------------------

	/**
	 * Generate a short random uid — format: burst-<8 hex chars>.
	 *
	 * @returns {string}
	 */
	function generateUid() {
		const arr = new Uint32Array( 1 );
		window.crypto.getRandomValues( arr );
		return 'burst-' + arr[ 0 ].toString( 16 ).padStart( 8, '0' );
	}

	function deactivateBlockGoalUid( blockUid ) {
		if ( settings.active_block_goal_uids ) {
			const idx = settings.active_block_goal_uids.indexOf( blockUid );
			if ( idx > -1 ) {
				settings.active_block_goal_uids.splice( idx, 1 );
				activeGoalCount = Math.max( 0, activeGoalCount - 1 );
			}
		}
	}

	function activateBlockGoalUid( blockUid ) {
		if ( ! settings.active_block_goal_uids ) {
			settings.active_block_goal_uids = [];
		}
		if ( ! settings.active_block_goal_uids.includes( blockUid ) ) {
			settings.active_block_goal_uids.push( blockUid );
			activeGoalCount++;
		}
	}

	/**
	 * Derive the current active block goal count from the live array.
	 * Falls back to the PHP-localized initial count if the array isn't populated yet.
	 *
	 * @returns {number}
	 */
	function getActiveGoalCount() {
		return activeGoalCount;
	}

	/**
	 * Return true if activating this goal would exceed the free limit.
	 *
	 * @param {boolean} isCurrentlyActive Whether the goal for this block is already active.
	 * @returns {boolean}
	 */
	function isLimitReached( isCurrentlyActive ) {
		if ( IS_PRO || GOAL_LIMIT < 0 ) {
			return false;
		}
		if ( isCurrentlyActive ) {
			// Deactivating an already active goal is always allowed.
			return false;
		}
		return getActiveGoalCount() >= GOAL_LIMIT;
	}

	/**
	 * Call the upsert_for_block REST endpoint.
	 *
	 * @param {Object} payload
	 * @returns {Promise<Object>}
	 */
	function upsertGoal( payload ) {
		return apiFetch( {
			url:     REST_URL + '/burst/v1/goals/upsert_for_block',
			method:  'POST',
			headers: {
				'X-WP-Nonce':   NONCE,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify( Object.assign( { nonce: BURST_NONCE }, payload ) ),
		} );
	}

	// ------------------------------------------------------------------
	// 1. Register block attributes on every allowed block type.
	// ------------------------------------------------------------------
	addFilter(
		'blocks.registerBlockType',
		'burst/add-goal-attributes',
		function ( settings, name ) {
			if ( ! ALLOWED_BLOCKS.includes( name ) ) {
				return settings;
			}
			return Object.assign( {}, settings, {
				attributes: Object.assign( {}, settings.attributes, {
					burstGoalUid: {
						type:    'string',
						default: '',
					},
					burstGoalActive: {
						type:    'boolean',
						default: false,
					},
					burstGoalId: {
						type:    'number',
						default: 0,
					},
				} ),
			} );
		}
	);

	// ------------------------------------------------------------------
	// 2. Inject `data-burst-goal` only when the goal is active.
	// ------------------------------------------------------------------
	addFilter(
		'blocks.getSaveContent.extraProps',
		'burst/inject-data-burst-goal',
		function ( extraProps, blockType, attributes ) {
			if ( ! ALLOWED_BLOCKS.includes( blockType.name ) ) {
				return extraProps;
			}
			if ( ! attributes.burstGoalUid || ! attributes.burstGoalActive ) {
				return extraProps;
			}
			return Object.assign( {}, extraProps, {
				'data-burst-goal': attributes.burstGoalUid,
			} );
		}
	);

	// ------------------------------------------------------------------
	// 3. Block controls enwrapper (Edit component).
	// ------------------------------------------------------------------
	const withBurstGoalPanel = createHigherOrderComponent( function ( BlockEdit ) {
		return function ( props ) {
			const { name, attributes, setAttributes, isSelected, clientId } = props;

			if ( ! ALLOWED_BLOCKS.includes( name ) ) {
				return el( BlockEdit, props );
			}

			// ---- local state ----
			const [ saving, setSaving ]         = useState( false );
			const [ error, setError ]           = useState( '' );
			const [ goalTitle, setGoalTitle ]   = useState( '' );
			const [ convMetric, setConvMetric ] = useState( 'visitors' );
			const isTemplateOrPattern = ( function () {
				try {
					if ( typeof pagenow !== 'undefined' && pagenow === 'site-editor' ) {
						return true;
					}
					if ( typeof wp !== 'undefined' && wp.data && wp.data.select( 'core/editor' ) ) {
						const postType = wp.data.select( 'core/editor' ).getCurrentPostType();
						const templateOrPatternTypes = [ 'wp_template', 'wp_template_part', 'wp_block', 'wp_navigation' ];
						if ( templateOrPatternTypes.includes( postType ) ) {
							return true;
						}
					}
					return false;
				} catch ( e ) {
					return false;
				}
			}() );

			// Derive the current post's path for page-scoped goals.
			// Falls back to '' if the post is a draft with no published URL yet.
			const currentPostPath = ( function () {
				try {
					const link    = wp.data.select( 'core/editor' ).getCurrentPost().link || '';
					const url     = new URL( link );
					const path    = url.pathname || '';
					// Ignore root '/' or preview-only URLs (drafts have ?p=123&preview=true)
					if ( path && path !== '/' && ! url.searchParams.has( 'preview' ) ) {
						return path;
					}
					return '';
				} catch ( e ) {
					return '';
				}
			}() );

			const [ pageScope, setPageScope ]   = useState( ( ! isTemplateOrPattern ) ? 'page' : 'website' );
			const [ isTitleCustomized, setIsTitleCustomized ] = useState( false );

			const currentPostId = ( function () {
				try {
					if ( typeof wp === 'undefined' || ! wp.data || ! wp.data.select( 'core/editor' ) ) {
						return 0;
					}
					return wp.data.select( 'core/editor' ).getCurrentPostId() || 0;
				} catch ( e ) {
					return 0;
				}
			}() );

			const uid            = attributes.burstGoalUid   || '';
			const goalId         = parseInt( attributes.burstGoalId, 10 ) || 0;
			const isTracking     = !! attributes.burstGoalActive;
			const limitReached   = isLimitReached( isTracking );

			// Derive a default title from the block content.
			function defaultTitle() {
				let text = '';
				let typeLabel = '';
				if ( name === 'core/button' ) {
					text = attributes.text
						? ( attributes.text.replace ? attributes.text.replace( /<[^>]+>/g, '' ) : String( attributes.text ) )
						: '';
					typeLabel = 'button';
				} else if ( name === 'core/image' ) {
					text = attributes.alt || attributes.caption || '';
					typeLabel = 'image';
				} else if ( name === 'core/navigation-link' ) {
					text = attributes.label || '';
					typeLabel = 'navigation';
				}

				if ( text ) {
					if ( typeLabel === 'button' ) {
						return sprintf( __( '%s button click', 'burst-statistics' ), text );
					}
					if ( typeLabel === 'image' ) {
						return sprintf( __( '%s image click', 'burst-statistics' ), text );
					}
					if ( typeLabel === 'navigation' ) {
						return sprintf( __( '%s navigation click', 'burst-statistics' ), text );
					}
				}

				if ( typeLabel === 'button' ) {
					return __( 'button click', 'burst-statistics' );
				}
				if ( typeLabel === 'image' ) {
					return __( 'image click', 'burst-statistics' );
				}
				if ( typeLabel === 'navigation' ) {
					return __( 'navigation click', 'burst-statistics' );
				}

				return __( 'block click', 'burst-statistics' );
			}

			// --------------------------------------------------------------
			// 3a. Duplication/Paste Detection Hook
			// --------------------------------------------------------------
			useEffect( function () {
				if ( uid ) {
					const blocks = wp.data.select( 'core/block-editor' ).getBlocks();
					const matchingClientIds = [];
					function walk( list ) {
						list.forEach( function ( block ) {
							if (
								block.attributes &&
								block.attributes.burstGoalUid === uid
							) {
								matchingClientIds.push( block.clientId );
							}
							if ( block.innerBlocks && block.innerBlocks.length ) {
								walk( block.innerBlocks );
							}
						} );
					}
					walk( blocks );

					// If there is more than one block with this UID, and this block is NOT the first one, reset it!
					if ( matchingClientIds.length > 1 && matchingClientIds[0] !== clientId ) {
						// Duplicated block detected! Generate a fresh UID and reset states.
						setAttributes( {
							burstGoalUid:    generateUid(),
							burstGoalId:     0,
							burstGoalActive: false,
						} );
					}
				}
			}, [ uid ] );

			// --------------------------------------------------------------
			// 3b. Central Database Source of Truth Synchronization Hook
			// --------------------------------------------------------------
			useEffect( function () {
				const goals = settings.goals || [];
				const matchingGoal = goals.find( function ( g ) {
					return ( uid && g.selector === `[data-burst-goal="${uid}"]` ) || ( goalId && g.id === goalId );
				} );

				if ( matchingGoal ) {
					// Check if this block was copied/duplicated from a different post/page (non-synced pattern check)
					try {
						const isPageIdDifferent = matchingGoal.page_id && currentPostId && parseInt( matchingGoal.page_id, 10 ) !== parseInt( currentPostId, 10 );
						
						const cleanPath = function ( p ) {
							return ( p || '' ).replace( /^\/|\/$/g, '' ).trim();
						};
						const isUrlDifferent = ! matchingGoal.page_id && matchingGoal.url && matchingGoal.url !== '*' && currentPostPath && cleanPath( matchingGoal.url ) !== cleanPath( currentPostPath );

						if ( isPageIdDifferent || isUrlDifferent ) {
							setAttributes( {
								burstGoalUid:    '',
								burstGoalId:     0,
								burstGoalActive: false,
							} );
							return;
						}
					} catch ( e ) {}

					// Seed state variables from the database record.
					setGoalTitle( matchingGoal.title );
					setConvMetric( matchingGoal.conversion_metric || 'visitors' );
					
					let scope = 'website';
					if ( matchingGoal.url && matchingGoal.url !== '*' ) {
						scope = 'page';
					}
					setPageScope( scope );

					// If the block claims to be active, but the server record says inactive, sync back.
					if ( matchingGoal.status !== 'active' && attributes.burstGoalActive ) {
						setAttributes( { burstGoalActive: false } );
					}
				} else {
					// If no database match is found at all, but block had active goal, clear active attributes.
					// We only clear if the block was actually active or has a DB ID, not for pending UIDs.
					if ( uid && ( attributes.burstGoalActive || attributes.burstGoalId > 0 ) ) {
						setAttributes( {
							burstGoalUid:    '',
							burstGoalId:     0,
							burstGoalActive: false,
						} );
					}
				}
			}, [ uid, goalId, currentPostId, currentPostPath ] );

			// Sync default title changes if user has not customized it yet.
			useEffect( function () {
				if ( ! isTitleCustomized && ! goalId ) {
					setGoalTitle( defaultTitle() );
				}
			}, [ attributes.text, attributes.alt, attributes.label, isTitleCustomized, goalId ] );

			// ---- handlers ----

			function handleToggle( enabled ) {
				setError( '' );

				if ( ! enabled ) {
					// Disable: deactivate on server, flip flag.
					setSaving( true );
					const deactivate = uid
						? upsertGoal( { uid: uid, status: 'inactive' } )
						: Promise.resolve();

					deactivate
						.then( function ( response ) {
							setSaving( false );
							deactivateBlockGoalUid( uid );
							// Update local localized array state.
							if ( response && response.goal && settings.goals ) {
								const existing = settings.goals.find( function ( g ) { return g.uid === uid; } );
								if ( existing ) {
									existing.status = 'inactive';
								}
							}
							setAttributes( { burstGoalActive: false } );
						} )
						.catch( function ( err ) {
							setSaving( false );
							setError( err.message || __( 'An error occurred.', 'burst-statistics' ) );
						} );
					return;
				}

				// Enable: reuse stored uid or generate a new one.
				const targetUid = uid || generateUid();
				setSaving( true );
				upsertGoal( {
					uid:               targetUid,
					title:             goalTitle || defaultTitle(),
					type:              'clicks',
					status:            'active',
					conversion_metric: convMetric,
					page_or_website:   pageScope,
					specific_page:     ( pageScope === 'page' ? currentPostPath : '' ),
					page_id:           ( pageScope === 'page' ? ( wp.data.select( 'core/editor' ) ? wp.data.select( 'core/editor' ).getCurrentPostId() : 0 ) : 0 ),
				} )
					.then( function ( response ) {
						setSaving( false );
						if ( response && response.success ) {
							const newId = parseInt( response.goal_id, 10 ) || 0;

							// Update client-side settings arrays.
							activateBlockGoalUid( targetUid );

							// Append/replace in localized goals list.
							if ( response.goal && settings.goals ) {
								const idx = settings.goals.findIndex( function ( g ) { return g.uid === targetUid; } );
								const formattedGoal = {
									id:                newId,
									title:             response.goal.title,
									type:              response.goal.type,
									status:            response.goal.status,
									url:               response.goal.url,
									conversion_metric: response.goal.conversion_metric,
									selector:          response.goal.selector,
									block_goal:        1,
									uid:               targetUid,
									has_data:          false,
									page_id:           response.goal.page_id,
									is_draft:          response.goal.is_draft,
								};
								if ( idx > -1 ) {
									settings.goals[ idx ] = formattedGoal;
								} else {
									settings.goals.push( formattedGoal );
								}
							}

							setAttributes( {
								burstGoalUid:    targetUid,
								burstGoalId:     newId,
								burstGoalActive: true,
							} );
							// active_block_goal_uids was already updated above; no separate counter needed.
						} else {
							setError(
								( response && response.message ) ||
								__( 'Failed to create goal.', 'burst-statistics' )
							);
						}
					} )
					.catch( function ( err ) {
						setSaving( false );
						setError( err.message || __( 'An error occurred.', 'burst-statistics' ) );
					} );
			}

			function handleSaveFields() {
				if ( ! isTracking ) return;
				setError( '' );
				setSaving( true );
				upsertGoal( {
					uid:               uid,
					title:             goalTitle,
					type:              'clicks',
					status:            'active',
					conversion_metric: convMetric,
					page_or_website:   pageScope,
					page_id:           ( pageScope === 'page' ? ( wp.data.select( 'core/editor' ) ? wp.data.select( 'core/editor' ).getCurrentPostId() : 0 ) : 0 ),
				} )
					.then( function ( response ) {
						setSaving( false );
						if ( response && response.success ) {
							if ( response.goal && settings.goals ) {
								const existing = settings.goals.find( function ( g ) { return g.uid === uid; } );
								if ( existing ) {
									existing.title             = response.goal.title;
									existing.conversion_metric = response.goal.conversion_metric;
									existing.url               = response.goal.url;
								}
							}
						} else {
							setError(
								( response && response.message ) ||
								__( 'Failed to update goal.', 'burst-statistics' )
							);
						}
					} )
					.catch( function ( err ) {
						setSaving( false );
						setError( err.message || __( 'An error occurred.', 'burst-statistics' ) );
					} );
			}

			// ---- inspector panel & block toolbar rendering ----

			if ( ! USER_CAN_MANAGE ) {
				return el( BlockEdit, props );
			}

			const panelContent = [];

			if ( error ) {
				panelContent.push(
					el( Notice, {
						key:           'burst-error',
						status:        'error',
						isDismissible: true,
						onRemove:      function () { setError( '' ); },
					}, error )
				);
			}

			panelContent.push(
				el( ToggleControl, {
					key:      'burst-toggle',
					label:    __( 'Track clicks with a Burst Goal', 'burst-statistics' ),
					checked:  isTracking,
					disabled: saving || ( ! isTracking && limitReached ),
					onChange: handleToggle,
					help:     saving ? __( 'Saving\u2026', 'burst-statistics' ) : undefined,
				} )
			);

			if ( ! isTracking && limitReached ) {
				panelContent.push(
					el( Notice, {
						key:           'burst-limit-notice',
						status:        'warning',
						isDismissible: false,
						actions: [
							{
								label:  __( 'Upgrade to Pro', 'burst-statistics' ),
								url:    'https://burst-statistics.com/pricing/?utm_source=block-editor&utm_medium=goals',
								target: '_blank',
							}
						]
					}, __( 'You have reached the limit of 3 goals in the Free version.', 'burst-statistics' ) )
				);
			}

			if ( isTracking ) {
				panelContent.push(
					el( TextControl, {
						key:      'burst-title',
						label:    __( 'Goal title', 'burst-statistics' ),
						value:    goalTitle,
						onChange: function ( val ) {
							setGoalTitle( val );
							setIsTitleCustomized( true );
						},
						onBlur:   handleSaveFields,
					} ),
					el( SelectControl, {
						key:     'burst-metric',
						label:   __( 'Conversion metric', 'burst-statistics' ),
						value:   convMetric,
						options: [
							{ label: __( 'Visitors',  'burst-statistics' ), value: 'visitors' },
							{ label: __( 'Sessions',  'burst-statistics' ), value: 'sessions' },
							{ label: __( 'Pageviews', 'burst-statistics' ), value: 'pageviews' },
						],
						onChange: function ( v ) {
							setConvMetric( v );
							upsertGoal( { uid: uid, conversion_metric: v } )
								.then( function ( response ) {
									if ( response && response.success && response.goal && settings.goals ) {
										const existing = settings.goals.find( function ( g ) { return g.uid === uid; } );
										if ( existing ) {
											existing.conversion_metric = response.goal.conversion_metric;
										}
									}
								} )
								.catch( function () {} );
						},
					} )
				);

				if ( ! isTemplateOrPattern ) {
					panelContent.push(
						el( SelectControl, {
							key:     'burst-scope',
							label:   __( 'Page scope', 'burst-statistics' ),
							value:   pageScope,
							options: [
								{ label: __( 'All pages',    'burst-statistics' ), value: 'website' },
								{ label: __( 'Current page', 'burst-statistics' ), value: 'page' },
							],
							onChange: function ( v ) {
								setPageScope( v );
								upsertGoal( {
									uid: uid,
									page_or_website: v,
									page_id: ( v === 'page' ? ( wp.data.select( 'core/editor' ) ? wp.data.select( 'core/editor' ).getCurrentPostId() : 0 ) : 0 ),
								} )
									.then( function ( response ) {
										if ( response && response.success && response.goal && settings.goals ) {
											const existing = settings.goals.find( function ( g ) { return g.uid === uid; } );
											if ( existing ) {
												existing.url = response.goal.url;
												existing.page_id = response.goal.page_id;
												existing.is_draft = response.goal.is_draft;
											}
										}
									} )
									.catch( function () {} );
							},
						} )
					);
				}
			}

			return el(
				Fragment,
				null,
				el( BlockEdit, props ),
				el(
					BlockControls,
					null,
					el(
						ToolbarGroup,
						null,
						el( ToolbarButton, {
							icon:     'analytics',
							title:    __( 'Track clicks with a Burst Goal', 'burst-statistics' ),
							isActive: isTracking,
							disabled: saving || ( ! isTracking && limitReached ),
							onClick:  function () {
								handleToggle( ! isTracking );
							},
						} )
					)
				),
				isSelected && el(
					InspectorControls,
					null,
					el(
						PanelBody,
						{
							title:       __( 'Burst Goal', 'burst-statistics' ),
							initialOpen: isTracking,
						},
						panelContent
					)
				)
			);
		};
	}, 'withBurstGoalPanel' );

	addFilter(
		'editor.BlockEdit',
		'burst/goal-inspector-panel',
		withBurstGoalPanel
	);

	// ------------------------------------------------------------------
	// 4. On switchTransform transform block transformed reset (transformed transform attributes).
	// ------------------------------------------------------------------
	addFilter(
		'blocks.switchToBlockType.transformedBlock',
		'burst/reset-uid-on-paste',
		function ( block ) {
			if ( ALLOWED_BLOCKS.includes( block.name ) && block.attributes.burstGoalUid ) {
				block.attributes = Object.assign( {}, block.attributes, {
					burstGoalUid:    '',
					burstGoalId:     0,
					burstGoalActive: false,
				} );
			}
			return block;
		}
	);

	// ------------------------------------------------------------------
	// 5. Intercept block removal — Gutenberg Modal confirm deletion 
	//    or deactivation of the associated goal.
	// ------------------------------------------------------------------
	const GoalDeletionModal = () => {
		const [ isOpen, setIsOpen ] = useState( false );
		const [ modalData, setModalData ] = useState( null );

		useEffect( () => {
			window.burstOpenGoalDeletionModal = ( data ) => {
				setModalData( data );
				setIsOpen( true );
			};
			return () => {
				delete window.burstOpenGoalDeletionModal;
			};
		}, [] );

		if ( ! isOpen || ! modalData ) {
			return null;
		}

		const { title, hasData, onConfirm, onCancel } = modalData;

		const handleConfirm = () => {
			setIsOpen( false );
			onConfirm();
		};

		const handleCancel = () => {
			setIsOpen( false );
			onCancel();
		};

		return el(
			Modal,
			{
				title: __( 'Confirm Block Deletion', 'burst-statistics' ),
				onRequestClose: handleCancel,
			},
			el(
				'div',
				{ className: 'burst-goal-deletion-modal' },
				el(
					'p',
					{ style: { fontSize: '14px', lineHeight: '1.5', marginBottom: '15px' } },
					hasData
						? sprintf(
							__( 'The block you are deleting has an active Burst Goal ("%s") with tracking statistics. The goal will be deactivated to preserve historical statistics in your reports.', 'burst-statistics' ),
							title
						)
						: sprintf(
							__( 'The block you are deleting has an active Burst Goal ("%s") with no tracking statistics. The goal will be deleted completely from the database.', 'burst-statistics' ),
							title
						)
				),
				el(
					'p',
					{ style: { fontSize: '14px', fontWeight: '500', marginBottom: '20px' } },
					__( 'Do you want to proceed with deleting the block?', 'burst-statistics' )
				),
				el(
					'div',
					{ style: { display: 'flex', gap: '10px', justifyContent: 'flex-end' } },
					el(
						Button,
						{ isSecondary: true, onClick: handleCancel },
						__( 'Keep block', 'burst-statistics' )
					),
					el(
						Button,
						{ isPrimary: true, isDestructive: true, onClick: handleConfirm },
						__( 'Delete block', 'burst-statistics' )
					)
				)
			)
		);
	};

	if ( wp.plugins && wp.plugins.registerPlugin ) {
		wp.plugins.registerPlugin( 'burst-goal-deletion-plugin', {
			render: GoalDeletionModal,
		} );
	}

	( function () {
		if ( ! wp.data || ! wp.data.dispatch ) {
			return;
		}

		let isDeletingApproved = false;

		const registry = wp.data;
		const originalRemoveBlocks = registry.dispatch( 'core/block-editor' ).removeBlocks;

		registry.dispatch( 'core/block-editor' ).removeBlocks = function ( clientIds, selectAfter ) {
			if ( ! USER_CAN_MANAGE ) {
				return originalRemoveBlocks( clientIds, selectAfter );
			}

			if ( isDeletingApproved ) {
				return originalRemoveBlocks( clientIds, selectAfter );
			}

			const ids = Array.isArray( clientIds ) ? clientIds : [ clientIds ];
			const blocks = ids.map( function ( id ) {
				return registry.select( 'core/block-editor' ).getBlock( id );
			} );

			let goalBlock = null;
			let targetGoal = null;

			function checkBlocks( list ) {
				list.forEach( function ( block ) {
					if ( ! block ) {
						return;
					}
					if (
						ALLOWED_BLOCKS.includes( block.name ) &&
						block.attributes &&
						block.attributes.burstGoalUid &&
						block.attributes.burstGoalActive
					) {
						const goal = ( settings.goals || [] ).find( function ( g ) {
							return g.uid === block.attributes.burstGoalUid;
						} );
						goalBlock = block;
						targetGoal = goal;
					}
					if ( block.innerBlocks && block.innerBlocks.length ) {
						checkBlocks( block.innerBlocks );
					}
				} );
			}
			checkBlocks( blocks );

			if ( goalBlock && window.burstOpenGoalDeletionModal ) {
				const blockUid = goalBlock.attributes.burstGoalUid;
				const hasData = targetGoal && ( parseInt( targetGoal.has_data, 10 ) > 0 || targetGoal.has_data === true || String( targetGoal.has_data ) === 'true' );
				const title = ( targetGoal && targetGoal.title ) || blockUid;

				window.burstOpenGoalDeletionModal( {
					title: title,
					hasData: hasData,
					onConfirm: function () {
						isDeletingApproved = true;

						const status = hasData ? 'inactive' : 'delete';
						upsertGoal( { uid: blockUid, status: status } )
							.then( function ( response ) {
								deactivateBlockGoalUid( blockUid );
								if ( settings.goals ) {
									if ( ! hasData ) {
										settings.goals = settings.goals.filter( function ( g ) {
											return g.uid !== blockUid;
										} );
									} else {
										const existing = settings.goals.find( function ( g ) {
											return g.uid === blockUid;
										} );
										if ( existing ) {
											existing.status = 'inactive';
										}
									}
								}
							} )
							.catch( function () {} );

						registry.dispatch( 'core/block-editor' ).removeBlocks( clientIds, selectAfter );
						isDeletingApproved = false;
					},
					onCancel: function () {
						// Keep block intact
					},
				} );

				return; // Block the original removeBlocks execution
			}

			return originalRemoveBlocks( clientIds, selectAfter );
		};
	}() );

}() );
