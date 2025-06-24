const teamupdraft_steps = teamupdraft_autoinstaller.steps;
let teamupdraft_download_link = '';
let teamupdraft_progress = 0;

//set up steps html
let teamupdraft_template = document.getElementById( 'teamupdraft-step-template' ).innerHTML;
let teamupdraft_start_button = document.getElementById( 'teamupdraft-start-button' ).innerHTML;
let teamupdraft_total_step_html = '';
teamupdraft_steps.forEach( ( step, i ) =>	{
	let stepHtml = teamupdraft_template;
	stepHtml = stepHtml.replace( '{doing}', step.doing );
	stepHtml = stepHtml.replace( '{step}', 'teamupdraft-step-' + i );
	teamupdraft_total_step_html += stepHtml;
});
document.querySelector( '.teamupdraft-install-steps' ).innerHTML = teamupdraft_total_step_html + teamupdraft_start_button;

const sanitizeRestAction = (action) => {
	const allowedActions = [
		'destination_clear',
		'activate_license',
		'package_information',
		'install_plugin',
		'activate_plugin',
	];

	return allowedActions.includes(action) ? action : '';
}
const ajaxRequest = async( path, requestData = null ) => {
	const url = teamupdraft_autoinstaller.admin_ajax_url+`&rest_action=${path.replace('?', '&')}`;
	const options = {
		method: 'GET',
		headers: {'Content-Type': 'application/json; charset=UTF-8'}
	};

	try {
		// the path consists of sanitized actions. Url is hardcoded in localize scripts.
		const response = await fetch(url, options); // nosemgrep
		if (!response.ok) {
			console.log(false, response.statusText);
			throw new Error(response.statusText);
		}

		const responseData = await response.json();

		if (
			!responseData.data ||
			!Object.prototype.hasOwnProperty.call(responseData.data, 'request_success')
		) {
			throw new Error('Invalid data error');
		}

		delete responseData.data.request_success;

		// return promise with the data object
		return Promise.resolve(responseData.data);
	} catch (error) {
		return Promise.reject(new Error('AJAX request failed'));
	}
}
const teamupdraft_set_progress = () => {
	if ( 100 <= teamupdraft_progress ) {
		teamupdraft_progress = 100;
	}
	let progress_bar_container = document.querySelector( '.teamupdraft-progress-bar-container' );
	let progressEl = progress_bar_container.querySelector( '.teamupdraft-progress' );
	let bar = progressEl.querySelector( '.teamupdraft-bar' );
	bar.style = 'width: ' + teamupdraft_progress + '%;';

	if ( 100 === teamupdraft_progress ) {
		clearInterval( window.rsp_interval );
	}
};

const teamupdraft_stop_progress = () => {
	clearInterval( window.rsp_interval );
	let progress_bar_container = document.querySelector( '.teamupdraft-progress-bar-container' );

	let progressEl = progress_bar_container.querySelector( '.teamupdraft-progress' );
	let bar = progressEl.querySelector( '.teamupdraft-bar' );
	bar.style = 'width: 100%;';
	bar.classList.remove( 'teamupdraft-green' );
	bar.classList.add( 'teamupdraft-red' );
	clearInterval( window.rsp_interval );
};

const glue = ( path ) => {
	path = teamupdraft_autoinstaller.rest_url + path;
	return path.indexOf( '?' ) === -1 ? '?' : '&';
};

const teamupdraft_process_response = ( response, current_step, step, progress_step ) => {
	response = response.data;
	const step_element = document.querySelector( '.teamupdraft-step-' + current_step );
	if ( ! step_element ) {
		return;
	}

	const step_color = step_element.querySelector( '.teamupdraft-step-color' );
	const step_text = step_element.querySelector( '.teamupdraft-step-text' );

	if ( response.success ) {
		if ( response.download_link ) {
			teamupdraft_download_link = response.download_link;
		}
		step_color.innerHTML = '<div class="teamupdraft-green teamupdraft-bullet"></div>';
		step_text.innerHTML = '<span>' + step.success + '</span>';

		if ( current_step + 1 === teamupdraft_steps.length ) {
			let templateHtml = document.getElementById( 'teamupdraft-plugin-suggestion-template' ).innerHTML;
			document.querySelector( '.teamupdraft-install-steps' ).innerHTML = templateHtml;
			document.querySelector( '.teamupdraft-install-plugin-modal h3' ).innerText = teamupdraft_autoinstaller.finished_title;
			document.querySelector( '.teamupdraft-btn.teamupdraft-visit-dashboard' ).classList.remove( 'teamupdraft-hidden' );
			document.querySelector('.teamupdraft-running').style.display = 'none';
			document.querySelector('.teamupdraft-done').style.display = 'block';

			teamupdraft_progress = 100;
			teamupdraft_set_progress();
		} else {
			teamupdraft_progress = progress_step;
			teamupdraft_set_progress();
			teamupdraft_process_step( current_step + 1 );
		}
	} else {
		step_color.innerHTML = '<div class="teamupdraft-red teamupdraft-bullet"></div>';
		if ( response.message ) {
			document.querySelector( '.teamupdraft-error-message.teamupdraft-' + step.type + ' span' ).innerText = response.message;
		}
		step_text.innerHTML = '<span>' + step.error + '</span>';
		teamupdraft_stop_progress();
		document.querySelector( '.teamupdraft-btn.teamupdraft-cancel' ).classList.remove( 'teamupdraft-hidden' );
		document.querySelector( '.teamupdraft-error-message.teamupdraft-' + step.type ).classList.remove( 'teamupdraft-hidden' );
	}
}

const teamupdraft_process_step = async ( current_step ) => {
	let progress_step = ( current_step + 1 ) * Math.ceil( 100 / ( teamupdraft_autoinstaller.steps.length ) );

	clearInterval( window.rsp_interval );
	window.rsp_interval = setInterval( function() {
		let inc = 0.5;
		//very slow if we're close to the target progress for this step.
		if ( ( teamupdraft_progress > progress_step - 1 ) ) {
			inc = 0.01;
		}

		teamupdraft_progress += inc;
		if ( 100 <= teamupdraft_progress ) {
			teamupdraft_progress = 100;
		}
		teamupdraft_set_progress();
	}, 100 );

	current_step = parseInt( current_step );
	let step = teamupdraft_steps[current_step];

	// Get arguments from url
	const query_string = window.location.search;
	const urlParams = new URLSearchParams( query_string );
	const action = sanitizeRestAction( step.action );
	let data = {
		'path': action,
		'token': teamupdraft_autoinstaller.token,
		'plugin': urlParams.get( 'plugin' ),
		'license': urlParams.get( 'license' ),
		'item_id': urlParams.get( 'item_id' ),
		'download_link': teamupdraft_download_link,
		'install_pro': true
	};
	const queryString = new URLSearchParams(data).toString();
	const path = `/teamupdraft/v1/auto_installer/${action}${glue()}${queryString}`;

	await wp.apiFetch( {
		path: path,
		method: 'GET',
	} ).then( ( response ) => {
		teamupdraft_process_response( response, current_step, step, progress_step );
	} ).catch( ( error ) => {

			//try with admin-ajax
			ajaxRequest( path, data ).then( ( response ) => {
				teamupdraft_process_response( response, current_step , step, progress_step);
			})
	});
};
document.addEventListener('DOMContentLoaded', function () {
	document.querySelectorAll('.teamupdraft-start').forEach(function (button) {
		button.addEventListener('click', function () {
			document.querySelectorAll('.teamupdraft-start').forEach(function (button) {
				button.disabled = true;
			});
			document.querySelector('.teamupdraft-initial').style.display = 'none';
			document.querySelector('.teamupdraft-running').style.display = 'block';
			teamupdraft_process_step(0);
		});
	});
});



