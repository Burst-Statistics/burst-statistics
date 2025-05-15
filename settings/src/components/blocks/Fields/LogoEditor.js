import {useFields} from '../../../store/useFieldsStore';
import { __ } from '@wordpress/i18n';
import {memo, useState} from '@wordpress/element';
import {useEffect} from 'react';
import Icon from '../../../utils/Icon';

const LogoEditor = ({ disabled, name, label, value, onChangeHandler }) => {
    const updateField = useFields( ( state ) => state.updateField );
    const setChangedField = useFields( ( state ) => state.setChangedField );
    const [ attachmentId, setAttachmentId ] = useState( value );
    const [ attachmentUrl, setAttachmentUrl ] = useState( '' );

    const updateAttachmentUrl = () => {
        if ( 0 < attachmentId ) {
            let attachment = wp.media.attachment( attachmentId );
            attachment.fetch().then( function() {

                // Once fetched, get the URL
                let url = '';
                if ( attachment.attributes.sizes.hasOwnProperty( 'medium' ) ) {
                    url = attachment.attributes.sizes.medium.url;
                } else if ( attachment.attributes.sizes.hasOwnProperty( 'large' ) ) {
                    url = attachment.attributes.sizes.large.url;
                } else if ( attachment.attributes.sizes.hasOwnProperty( 'full' ) ) {
                    url = attachment.attributes.sizes.full.url;
                }
                setAttachmentUrl( url );
            });
        } else {
            setAttachmentUrl( burst_settings.plugin_url + 'assets/img/burst-email-logo.png' );
        }
    };

    useEffect( () => {
        updateAttachmentUrl();
    }, []);

    let frame;
    const runUploader = ( event ) => {

        // If the media frame already exists, reopen it.
        if ( frame ) {
            frame.open();
            return;
        }

        // Create a new media frame
        frame = wp.media({
            title: __( 'Select a logo', 'burst-statistics' ),
            button: {
                text: __( 'Set logo', 'burst-statistics' )
            },
            multiple: false // Set to true to allow multiple files to be selected
        });

        // When an image is selected in the media frame...
        frame.on( 'select', function() {
            let length = frame.state().get( 'selection' ).length;
            let images = frame.state().get( 'selection' ).models;

            for ( let iii = 0; iii < length; iii++ ) {
                let thumbnail_id = images[iii].id;
                let image = false;
                image = images[iii].attributes.sizes.medium;

                if ( ! image ) {
                    image = images[iii].attributes.sizes.thumbnail;
                }
                if ( ! image ) {
                    image = images[iii].attributes.sizes.full;
                }

                if ( image ) {
                    let image_url = image.url;
                    setAttachmentId( thumbnail_id );
                    setAttachmentUrl( image_url );
                    updateField( name, thumbnail_id );
                    setChangedField( name, thumbnail_id );
                }

            }
        });

        // Finally, open the modal on click
        frame.open();
    };
    let disabledClass = disabled ? 'disabled' : '';

    //https://wordpress.stackexchange.com/questions/368238/how-use-wp-media-upload-liberary-in-react-components
    return (
        <div className="burst-field">
            {label}
            <div className="burst-logo-container">
                <div className={'burst-logo-preview burst-clickable ' + disabledClass} onClick={() => runUploader()}>
                    {'' === attachmentUrl && <Icon name="loading" size={'18'}/>}
                    {'' !== attachmentUrl && <img src={attachmentUrl} alt="Banner Logo" className="burst-custom-image"/>}
                </div>
            </div>
        </div>

    );
};
export default memo( LogoEditor );
