import { forwardRef, useState, useEffect } from 'react';
import TextAreaInput from '@/components/Inputs/TextAreaInput';
import ButtonInput from '@/components/Inputs/ButtonInput';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import { __ } from '@wordpress/i18n';

/**
 * IpBlockField component
 */
const IpBlockField = forwardRef(
  ({ field, fieldState, label, help, context, className, ...props }, ref) => {
    const inputId = props.id || field.name;
    const ip = burst_settings.current_ip;
    // Ensure value is always a string
    const value = field.value || '';

    const handleChange = (e) => {
      // Don't prevent or modify the input - allow line breaks
      const newValue = e.target.value;
      field.onChange(newValue);
    };

    const handleAddIP = () => {
      if (!ip) {
        return;
      }

      // Parse the current list of IPs
      const currentValue = value || '';
      
      // Normalize line endings and split
      const normalizedValue = currentValue.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
      // Split by newlines and filter out empty lines
      const ipList = normalizedValue.split('\n')
        .map(line => line.trim())
        .filter(line => line !== '');

      // Add IP to the list
      let updatedIPList;
      
      if (ipList.length === 0) {
        // If list is empty, just add the IP
        updatedIPList = ip;
      } else {
        // Properly append the new IP with a newline
        if (normalizedValue.trim() === '') {
          // If empty or just whitespace
          updatedIPList = ip;
        } else if (normalizedValue.endsWith('\n')) {
          // If already ends with newline
          updatedIPList = normalizedValue + ip;
        } else {
          // Add a newline then the IP
          updatedIPList = normalizedValue + '\n' + ip;
        }
      }
      
      field.onChange(updatedIPList);
    };

    // Check if the "Add current IP" button should be disabled
    // Compare with normalized IPs to avoid false negatives due to whitespace
    const ipExists = () => {
      if (!ip) return true;
      
      const normalizedValue = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const ipList = normalizedValue.split('\n')
        .map(line => line.trim())
        .filter(line => line !== '');
      
      return ipList.includes(ip);
    };

    return (
      <FieldWrapper
        label={label}
        help={help}
        error={fieldState?.error?.message}
        context={context}
        className={className}
        inputId={inputId}
        required={props.required}
      >
        <div className="space-y-2 w-full">
          <TextAreaInput
            ref={ref}
            id={inputId}
            placeholder={'127.0.0.1\n192.168.0.1'}
            aria-invalid={!!fieldState?.error?.message}
            onChange={handleChange}
            value={value}
            rows={4}
            {...props}
          />
          <ButtonInput
            onClick={handleAddIP}
            disabled={!ip || ipExists()}
            btnVariant="tertiary"
            size="md"
          >
            {__('Add current IP address', 'burst-statistics')}
          </ButtonInput>
        </div>
      </FieldWrapper>
    );
  }
);

IpBlockField.displayName = 'IpBlockField';
export default IpBlockField;
