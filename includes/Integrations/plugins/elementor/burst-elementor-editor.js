/**
 * Burst Statistics — Elementor Editor Integration
 *
 * Adds interactive goal controls, live database synchronization, duplication
 * detection, and deletion cleanup to the Elementor page builder.
 */
( function ( $, window, document ) {
	'use strict';

	// ------------------------------------------------------------------
	// Settings passed from PHP via wp_localize_script( 'burstElementorEditor' ).
	// ------------------------------------------------------------------
	const settings = window.burstElementorEditor || {};

	const USER_CAN_MANAGE    = String( settings.user_can_manage ) === '1' || settings.user_can_manage === true || String( settings.user_can_manage ) === 'true';
	const INITIAL_GOAL_COUNT = parseInt( settings.goal_count, 10 ) || 0;
	const GOAL_LIMIT         = parseInt( settings.goal_limit, 10 );   // -1 = unlimited (Pro)
	const IS_PRO             = String( settings.is_pro ) === '1' || settings.is_pro === true || String( settings.is_pro ) === 'true';

	const CLICKABLE_WIDGETS = Array.isArray( settings.clickable_widgets ) && settings.clickable_widgets.length
		? settings.clickable_widgets
		: [
			'button',
			'icon',
			'icon-box',
			'image',
			'image-box',
			'call-to-action',
			'animated-headline',
			'price-table',
			'form',
			'nav-menu',
			'search-form'
		];

	const wpI18n  = window.wp && window.wp.i18n ? window.wp.i18n : null;
	const __      = wpI18n ? wpI18n.__ : function ( str ) { return str; };
	const sprintf = wpI18n ? wpI18n.sprintf : function ( str ) { return str; };

	let activeGoalCount = INITIAL_GOAL_COUNT;

	/**
	 * Generate a short random UID — format: burst-<8 hex chars>.
	 *
	 * @returns {string}
	 */
	function generateUid() {
		const arr = new Uint32Array( 1 );
		window.crypto.getRandomValues( arr );
		return 'burst-' + arr[ 0 ].toString( 16 ).padStart( 8, '0' );
	}

	/**
	 * Check if an Elementor widget type is considered clickable/interactive.
	 *
	 * @param {string} widgetType Widget type name.
	 * @returns {boolean}
	 */
	function isClickableWidget( widgetType ) {
		if ( ! widgetType || typeof widgetType !== 'string' ) {
			return false;
		}
		if ( CLICKABLE_WIDGETS.includes( widgetType ) ) {
			return true;
		}
		const lower = widgetType.toLowerCase();
		return lower.includes( 'button' )
			|| lower.includes( 'nav-link' )
			|| lower.includes( 'link' )
			|| lower.includes( 'cta' )
			|| lower.includes( 'icon' )
			|| lower.includes( 'image' );
	}

	/**
	 * Determine default goal trigger type based on element nature.
	 *
	 * @param {string} widgetType Widget type name.
	 * @returns {string} 'clicks' or 'views'
	 */
	function getDefaultGoalType( widgetType ) {
		return isClickableWidget( widgetType ) ? 'clicks' : 'views';
	}

	function deactivateBlockGoalUid( blockUid ) {
		if ( ! blockUid ) {
			return;
		}
		if ( settings.active_block_goal_uids ) {
			const idx = settings.active_block_goal_uids.indexOf( blockUid );
			if ( idx > -1 ) {
				settings.active_block_goal_uids.splice( idx, 1 );
				activeGoalCount = Math.max( 0, activeGoalCount - 1 );
			}
		}
		if ( Array.isArray( settings.goals ) ) {
			const existing = settings.goals.find( function ( g ) { return g.uid === blockUid; } );
			if ( existing ) {
				existing.status = 'inactive';
			}
		}
	}

	function activateBlockGoalUid( blockUid ) {
		if ( ! blockUid ) {
			return;
		}
		if ( ! settings.active_block_goal_uids ) {
			settings.active_block_goal_uids = [];
		}
		if ( ! settings.all_block_goal_uids ) {
			settings.all_block_goal_uids = [];
		}
		if ( ! settings.goals ) {
			settings.goals = [];
		}

		if ( ! settings.all_block_goal_uids.includes( blockUid ) ) {
			settings.all_block_goal_uids.push( blockUid );
		}
		if ( ! settings.active_block_goal_uids.includes( blockUid ) ) {
			settings.active_block_goal_uids.push( blockUid );
			activeGoalCount++;
		}
		const existing = settings.goals.find( function ( g ) { return g.uid === blockUid; } );
		if ( existing ) {
			existing.status = 'active';
		} else {
			settings.goals.push( {
				uid:        blockUid,
				status:     'active',
				block_goal: 1,
			} );
		}
	}

	/**
	 * Return true if activating this goal would exceed the free limit.
	 *
	 * @param {boolean} isCurrentlyActive Whether the goal for this element is already active.
	 * @returns {boolean}
	 */
	function isLimitReached( isCurrentlyActive ) {
		if ( IS_PRO || GOAL_LIMIT < 0 ) {
			return false;
		}
		if ( isCurrentlyActive ) {
			return false;
		}
		return activeGoalCount >= GOAL_LIMIT;
	}

	/**
	 * Derive a smart default title based on widget settings and type.
	 *
	 * @param {string} widgetType Widget/element type name.
	 * @param {Object} settingsModel Backbone model of element settings.
	 * @param {string} goalType 'clicks' or 'views'.
	 * @returns {string}
	 */
	function generateDefaultTitle( widgetType, settingsModel, goalType ) {
		let text = '';
		let typeLabel = '';

		const rawText = settingsModel.get( 'text' )
			|| settingsModel.get( 'title' )
			|| settingsModel.get( 'title_text' )
			|| settingsModel.get( 'cta_button_text' )
			|| settingsModel.get( 'cta_title' )
			|| settingsModel.get( 'form_name' )
			|| '';

		if ( typeof rawText === 'string' && rawText.trim() ) {
			text = rawText.replace( /<[^>]+>/g, '' ).trim();
		} else if ( settingsModel.get( 'image' ) && settingsModel.get( 'image' ).alt ) {
			text = String( settingsModel.get( 'image' ).alt ).trim();
		}

		if ( widgetType === 'button' ) {
			typeLabel = __( 'button', 'burst-statistics' );
		} else if ( widgetType === 'image' || widgetType === 'image-box' ) {
			typeLabel = __( 'image', 'burst-statistics' );
		} else if ( widgetType === 'icon' || widgetType === 'icon-box' ) {
			typeLabel = __( 'icon', 'burst-statistics' );
		} else if ( widgetType === 'heading' ) {
			typeLabel = __( 'heading', 'burst-statistics' );
		} else if ( widgetType === 'form' ) {
			typeLabel = __( 'form', 'burst-statistics' );
		} else {
			typeLabel = widgetType || __( 'element', 'burst-statistics' );
		}

		if ( text && text.length > 30 ) {
			text = text.substring( 0, 30 ) + '…';
		}

		const isClickable = isClickableWidget( widgetType );
		const effectiveType = isClickable ? ( goalType || 'clicks' ) : 'views';

		if ( effectiveType === 'views' ) {
			if ( text ) {
				return sprintf( __( '%s %s visibility', 'burst-statistics' ), text, typeLabel );
			}
			return sprintf( __( '%s visibility', 'burst-statistics' ), typeLabel );
		}

		if ( text ) {
			return sprintf( __( '%s %s click', 'burst-statistics' ), text, typeLabel );
		}
		return sprintf( __( '%s click', 'burst-statistics' ), typeLabel );
	}

	/**
	 * Recursively scan and sanitize the entire Elementor element tree:
	 * 1. Un-toggles and clears goal attributes for goals that were deleted from Burst Admin.
	 * 2. Detects cloned/duplicated elements with duplicate UIDs and resets the clone.
	 */
	function sanitizeAllElements() {
		if ( ! window.elementor || ! window.elementor.elements ) {
			return;
		}

		const currentPostId = parseInt( ( window.elementor && window.elementor.config && window.elementor.config.document && window.elementor.config.document.id ) || settings.post_id || 0, 10 );
		const allBlockUids  = settings.all_block_goal_uids || [];
		const goalsList     = Array.isArray( settings.goals ) ? settings.goals : [];
		const seenUids      = new Set();

		function traverse( elementsCollection ) {
			if ( ! elementsCollection || ! elementsCollection.each ) {
				return;
			}

			elementsCollection.each( function ( elModel ) {
				const elSettings = elModel.get( 'settings' );
				if ( elSettings ) {
					const uid      = elSettings.get( 'burst_goal_uid' ) || '';
					const isActive = elSettings.get( 'burst_goal_active' ) === 'yes';

					if ( uid ) {
						const matchingGoal  = goalsList.find( function ( g ) { return g.uid === uid; } );
						const isForeignGoal = matchingGoal && matchingGoal.page_id > 0 && currentPostId > 0 && matchingGoal.page_id !== currentPostId;

						// 1. Check for Duplicate UID (cloned element) or Foreign Goal UID (cross-document paste)
						if ( seenUids.has( uid ) || isForeignGoal ) {
							const elementType = elModel.get( 'elType' ) || 'widget';
							const widgetType  = elModel.get( 'widgetType' ) || elementType;
							const defaultType = getDefaultGoalType( widgetType );
							const newUid      = generateUid();

							elSettings.set( {
								burst_goal_uid:    newUid,
								burst_goal_id:     0,
								burst_goal_active: isActive ? 'yes' : '',
								burst_goal_type:   elSettings.get( 'burst_goal_type' ) || defaultType,
								burst_goal_title:  elSettings.get( 'burst_goal_title' ) || '',
							}, { silent: true } );
							seenUids.add( newUid );
							if ( isActive ) {
								activateBlockGoalUid( newUid );
							}
							markEditorChanged();
						} else {
							seenUids.add( uid );

							// 2. Check for Goal deleted from Burst Admin / Settings
							// If goal is active in element settings, but not in database goals:
							const existsInDb = allBlockUids.includes( uid ) || goalsList.some( function ( g ) { return g.uid === uid; } );
							if ( isActive && ! existsInDb ) {
								deactivateBlockGoalUid( uid );
								elSettings.set( {
									burst_goal_active: '',
									burst_goal_uid:    '',
									burst_goal_title:  '',
									burst_goal_id:     0,
								}, { silent: true } );
							}
						}
					} else if ( isActive ) {
						// Element is marked active but has no UID at all: reset
						elSettings.set( {
							burst_goal_active: '',
							burst_goal_uid:    '',
							burst_goal_title:  '',
							burst_goal_id:     0,
						}, { silent: true } );
					}
				}

				const children = elModel.get( 'elements' );
				if ( children ) {
					traverse( children );
				}
			} );
		}

		traverse( window.elementor.elements );
	}

	/**
	 * Mark Elementor editor document as changed so the Update/Publish button activates.
	 */
	function markEditorChanged() {
		try {
			if ( window.elementor && window.elementor.saver ) {
				if ( typeof window.elementor.saver.setFlagEditorChange === 'function' ) {
					window.elementor.saver.setFlagEditorChange( true );
				}
			}
		} catch ( e ) {}
	}

	/**
	 * Setup Burst Goals panel model listeners.
	 *
	 * @param {Object} panel Elementor panel instance.
	 * @param {Object} model Elementor element model.
	 * @param {Object} view Elementor element view.
	 */
	function setupBurstGoalControls( panel, model, view ) {
		if ( ! USER_CAN_MANAGE || ! model ) {
			return;
		}

		// Run tree sanitization first to clean any stale or cloned goals across the document.
		sanitizeAllElements();

		const settingsModel = model.get( 'settings' );
		if ( ! settingsModel ) {
			return;
		}

		const elementType = model.get( 'elType' ) || 'widget';
		const widgetType  = model.get( 'widgetType' ) || elementType;
		const isClickable = isClickableWidget( widgetType );
		const defaultType = getDefaultGoalType( widgetType );

		// ------------------------------------------------------------------
		// 1. Database Sync on Panel Open (handle goals deleted from Burst Admin)
		// ------------------------------------------------------------------
		function syncWithDatabase() {
			const currentUid = settingsModel.get( 'burst_goal_uid' ) || '';
			const isTracking = settingsModel.get( 'burst_goal_active' ) === 'yes';

			// Only reset if the element claims to be tracking and UID is missing from DB
			if ( isTracking && currentUid ) {
				const allBlockUids = settings.all_block_goal_uids || [];
				const goalsList    = Array.isArray( settings.goals ) ? settings.goals : [];
				const existsInDb   = allBlockUids.includes( currentUid ) || goalsList.some( function ( g ) { return g.uid === currentUid; } );

				if ( ! existsInDb ) {
					// Goal was deleted from Burst settings/admin: reset element goal state!
					deactivateBlockGoalUid( currentUid );
					settingsModel.set( {
						burst_goal_active: '',
						burst_goal_uid:    '',
						burst_goal_title:  '',
						burst_goal_type:   defaultType,
					}, { silent: true } );

					if ( panel && panel.$el ) {
						panel.$el.find( '.elementor-control-burst_goal_active input[type="checkbox"], .elementor-control-burst_goal_active .elementor-switch-input' ).prop( 'checked', false );
						panel.$el.find( '.elementor-control-burst_goal_title input' ).val( '' );
					}
				}
			}
		}

		syncWithDatabase();
		setTimeout( syncWithDatabase, 150 );

		// Synchronize trigger type options in the panel UI based on element nature
		function syncTypeControlUI() {
			if ( ! panel || ! panel.$el ) {
				return;
			}
			const $typeControl = panel.$el.find( '.elementor-control-burst_goal_type' );
			if ( ! $typeControl.length ) {
				return;
			}

			const $select = $typeControl.find( 'select' );
			const $clicksOption = $select.find( 'option[value="clicks"]' );

			if ( ! isClickable ) {
				if ( $clicksOption.length ) {
					$clicksOption.remove();
				}
				$select.val( 'views' );
				if ( settingsModel.get( 'burst_goal_type' ) !== 'views' ) {
					settingsModel.set( 'burst_goal_type', 'views', { silent: true } );
				}
			} else {
				if ( ! $clicksOption.length ) {
					$select.prepend( '<option value="clicks">' + __( 'Click (on user click)', 'burst-statistics' ) + '</option>' );
				}
				const currentVal = settingsModel.get( 'burst_goal_type' ) || 'clicks';
				$select.val( currentVal );
			}
		}

		syncTypeControlUI();
		setTimeout( syncTypeControlUI, 150 );

		// Dynamic limit notice visibility for Free version
		function syncLimitNoticeUI() {
			if ( ! panel || ! panel.$el || IS_PRO ) {
				return;
			}
			const $notice = panel.$el.find( '.burst-goal-limit-notice' );
			if ( ! $notice.length ) {
				return;
			}
			const isTracking = settingsModel.get( 'burst_goal_active' ) === 'yes';
			const currentUid = settingsModel.get( 'burst_goal_uid' ) || '';
			const isCurrentlyActive = ( settings.active_block_goal_uids || [] ).includes( currentUid );
			const shouldShow = isTracking && activeGoalCount >= GOAL_LIMIT && ! isCurrentlyActive;
			$notice.toggle( shouldShow );
		}

		syncLimitNoticeUI();
		setTimeout( syncLimitNoticeUI, 150 );

		// ------------------------------------------------------------------
		// 2. Model Change Listeners (remove previous handlers to prevent duplicate firing)
		// ------------------------------------------------------------------
		settingsModel.off( 'change:burst_goal_active change:burst_goal_type change:burst_goal_title change:burst_goal_metric change:burst_goal_scope' );

		// Listen to Active Toggle
		settingsModel.on( 'change:burst_goal_active', function ( sm, val ) {
			const isNowActive = val === 'yes';
			const currentUid = sm.get( 'burst_goal_uid' ) || '';

			if ( isNowActive ) {
				if ( isLimitReached( false ) ) {
					sm.set( 'burst_goal_active', '', { silent: true } );
					if ( panel && panel.$el ) {
						panel.$el.find( '.elementor-control-burst_goal_active input[type="checkbox"]' ).prop( 'checked', false );
					}
					if ( window.elementor && window.elementor.notifications ) {
						window.elementor.notifications.showToast( {
							type:    'warning',
							message: __( 'Goal limit reached. Upgrade to Burst Pro for unlimited goals.', 'burst-statistics' ),
						} );
					} else {
						alert( __( 'You have reached the limit of 3 active goals in the Free version. Upgrade to Pro for unlimited goals.', 'burst-statistics' ) );
					}
					return;
				}

				const targetUid = currentUid || generateUid();
				const targetType = isClickable ? ( sm.get( 'burst_goal_type' ) || defaultType ) : 'views';
				let targetTitle = sm.get( 'burst_goal_title' ) || '';
				if ( ! targetTitle || typeof targetTitle !== 'string' || ! targetTitle.trim() ) {
					targetTitle = generateDefaultTitle( widgetType, sm, targetType );
				}
				if ( ! targetTitle || typeof targetTitle !== 'string' || ! targetTitle.trim() ) {
					targetTitle = ( widgetType || 'Element' ) + ' ' + ( targetType === 'clicks' ? 'click' : 'visibility' );
				}

				sm.set( {
					burst_goal_uid:   targetUid,
					burst_goal_type:  targetType,
					burst_goal_title: targetTitle,
				}, { silent: true } );

				if ( panel && panel.$el ) {
					panel.$el.find( '.elementor-control-burst_goal_title input' ).val( targetTitle );
					panel.$el.find( '.elementor-control-burst_goal_type select' ).val( targetType );
					syncTypeControlUI();
					syncLimitNoticeUI();
				}

				activateBlockGoalUid( targetUid );
			} else if ( currentUid ) {
				deactivateBlockGoalUid( currentUid );
				syncLimitNoticeUI();
			}

			markEditorChanged();
		} );

		// Listen to Type changes to update default title
		settingsModel.on( 'change:burst_goal_type', function ( sm, val ) {
			const currentTitle = sm.get( 'burst_goal_title' );
			const prevType = val === 'clicks' ? 'views' : 'clicks';
			const oldDefault = generateDefaultTitle( widgetType, sm, prevType );
			if ( ! currentTitle || currentTitle === oldDefault ) {
				const newDefault = generateDefaultTitle( widgetType, sm, val );
				sm.set( 'burst_goal_title', newDefault, { silent: true } );
				if ( panel && panel.$el ) {
					panel.$el.find( '.elementor-control-burst_goal_title input' ).val( newDefault );
				}
			}
			markEditorChanged();
		} );

		settingsModel.on( 'change:burst_goal_title', markEditorChanged );
		settingsModel.on( 'change:burst_goal_metric', markEditorChanged );
		settingsModel.on( 'change:burst_goal_scope', markEditorChanged );
	}

	/**
	 * Attach recursive collection listeners to sanitize elements on add/duplicate.
	 *
	 * @param {Object} collection Backbone collection of elements.
	 */
	function bindElementCollection( collection ) {
		if ( ! collection || ! collection.on ) {
			return;
		}

		collection.on( 'add', function ( elModel ) {
			setTimeout( sanitizeAllElements, 50 );
			const childCollection = elModel && elModel.get ? elModel.get( 'elements' ) : null;
			if ( childCollection ) {
				bindElementCollection( childCollection );
			}
		} );

		collection.each( function ( elModel ) {
			const childCollection = elModel && elModel.get ? elModel.get( 'elements' ) : null;
			if ( childCollection ) {
				bindElementCollection( childCollection );
			}
		} );
	}

	// ------------------------------------------------------------------
	// 3. Register with Elementor Hooks and Lifecycle
	// ------------------------------------------------------------------
	$( window ).on( 'elementor:init', function () {
		if ( ! window.elementor || ! window.elementor.hooks ) {
			return;
		}

		window.elementor.hooks.addAction( 'panel/open_editor/widget', setupBurstGoalControls );
		window.elementor.hooks.addAction( 'panel/open_editor/section', setupBurstGoalControls );
		window.elementor.hooks.addAction( 'panel/open_editor/container', setupBurstGoalControls );
		window.elementor.hooks.addAction( 'panel/open_editor/column', setupBurstGoalControls );

		// Sanitize tree when preview is loaded or ready
		if ( window.elementor.on ) {
			window.elementor.on( 'preview:loaded', function () {
				sanitizeAllElements();
				bindElementCollection( window.elementor.elements );
			} );
		}

		// Sanitize right before document save
		if ( window.elementor.saver && window.elementor.saver.on ) {
			window.elementor.saver.on( 'before:save', sanitizeAllElements );
		}

		// Initial tree sanitization
		setTimeout( function () {
			sanitizeAllElements();
			bindElementCollection( window.elementor.elements );
		}, 300 );
	} );

} )( jQuery, window, document );

