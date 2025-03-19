import {create} from 'zustand';
import {produce} from 'immer';
import * as burst_api from '../utils/api';

const fetchFields = () => {
  return burst_api.getFields().then( ( response ) => {
    let fields = response.fields;
    let progress = response.progress;
    return {fields, progress};
  }).catch( ( error ) => {
    console.error( error );
  });
};

export const useFields = create( ( set, get ) => ({
  fieldsLoaded: false,
  fields: [],
  changedFields: [],
  progress: [],
  nextButtonDisabled: false,
  highLightField: '',
  setHighLightField: ( highLightField ) => set( state => ({ highLightField }) ),
  setChangedField: async( id, value ) => {
    set(
        produce( ( state ) => {

          //remove current reference
          const existingFieldIndex = state.changedFields.findIndex( field => { //find index of existing field
            return field.id === id;
          });

          if ( -1 !== existingFieldIndex ) {
            state.changedFields.splice( existingFieldIndex, 1 );
          }

          //add again, with new value
          let field = {};
          field.id = id;
          field.value = value;
          state.changedFields.push( field );
        })
    );

    let conditionallyEnabledFields = updateFieldsListWithConditions( get().fields );
    set( ( state ) => ({fields: conditionallyEnabledFields}) );

  },
  getFieldValue: ( id ) => {
    let fields = get().fields;
    for ( const fieldItem of fields ) {
      if ( fieldItem.id === id ) {
        return fieldItem.value;
      }
    }
    return false;
  },
  updateField: ( id, value ) => {
    set(
        produce( ( state ) => {
          let index = false;
          state.fields.forEach( function( fieldItem, i ) {
            if ( fieldItem.id === id ) {
              index = i;
            }
          });
          state.fields[index].value = value;
        })
    );
  },

  addHelpNotice: ( id, label, text, title, url ) => {

    //create help object

    let help = {};
    help.label = label;
    help.text = text;
    if ( url ) {
help.url = url;
}
    if ( title ) {
help.title = title;
}
    set(
        produce( ( state ) => {
          const fieldIndex = state.fields.findIndex( field => {
            return field.id === id;
          });
          if ( -1 !== fieldIndex ) {
            state.fields[fieldIndex].help = help;
          }
        })
    );
  },
  saveFields: async() => {
    try {
      let fields = get().fields;
      let changedFields = get().changedFields;
      let progress = get().progress;
      let saveFields = [];
      for ( const field of fields ) {
        let fieldIsIncluded = 0 < changedFields.filter( changedField => changedField.id === field.id ).length;
        if ( fieldIsIncluded ) {
          saveFields.push( field );
        }
      }
      if ( 0 === saveFields.length ) {
        return Promise.resolve();
      }

      const response = await burst_api.setFields( saveFields );
      progress = response.progress;
      fields = updateFieldsListWithConditions( response.fields );

      set( ( state ) => ({changedFields: [], fields: fields, progress: progress}) );
      return Promise.resolve( response );
    } catch ( error ) {
      console.error( error );
      return Promise.reject( error );
    }
  },

  updateFieldsData: async( selectedSubMenuItem ) => {
    let fields = get().fields;

    fields = updateFieldsListWithConditions( fields );
    const nextButtonDisabled = isNextButtonDisabled( fields, selectedSubMenuItem );

    set(
        produce( ( state ) => {
          state.fields = fields;
          state.nextButtonDisabled = nextButtonDisabled;
        })
    );
  },
  fetchFieldsData: async( selectedSubMenuItem ) => {
    const { fields, progress }   = await fetchFields();
      const progressArray = Object.values(progress);
    //process pro field
    if ( burst_settings.is_pro ) {
      for ( const field of fields ) {
        if ( field.pro ) {
          if ( field.pro.default ) {
field.default = field.pro.default;
}
          if ( field.pro.label ) {
field.label = field.pro.label;
}
          if ( field.pro.comment ) {
field.comment = field.pro.comment;
}
          if ( field.pro.tooltip ) {
            field.tooltip = field.pro.tooltip;
}
          if ( field.pro.react_conditions ) {
            field.react_conditions = field.pro.react_conditions;
            }
        }
      }
    }
    let conditionallyEnabledFields = updateFieldsListWithConditions( fields );
    let selectedFields = conditionallyEnabledFields.filter( field => field.menu_id === selectedSubMenuItem );
    set( ( state ) => ({fieldsLoaded: true, fields: conditionallyEnabledFields, selectedFields: selectedFields, progress: progress }) );
  }
}) );

//check if all required fields have been enabled. If so, enable save/continue button
const isNextButtonDisabled = ( fields, selectedMenuItem ) => {
  let fieldsOnPage = [];

  //get all fields with group_id this.props.group_id
  for ( const field of fields ) {
    if ( field.menu_id === selectedMenuItem ) {
      fieldsOnPage.push( field );
    }
  }

  let requiredFields = fieldsOnPage.filter( field => field.required && ! field.conditionallyDisabled && ( 0 == field.value.length || ! field.value ) );
  return 0 < requiredFields.length;
};

export const updateFieldsListWithConditions = ( fields ) => {
  return fields.map( field => {
    const enabled = ! ( field.hasOwnProperty( 'react_conditions' ) && ! validateConditions( field.react_conditions, fields, field.id ) );
    const newField = {...field};

    if ( 'disable' === newField.condition_action ) {
      newField.disabled = ! enabled;
    } else {
      newField.conditionallyDisabled = ! enabled;
    }

    return newField;
  });
};

export const validateConditions = ( conditions, fields, fieldId, isSub ) => {
  let relation = 'OR' === conditions.relation ? 'OR' : 'AND';
  let conditionApplies = 'AND' === relation;
  for ( const key in conditions ) {
    if ( conditions.hasOwnProperty( key ) ) {
      let thisConditionApplies = 'AND' === relation;
      let subConditionsArray = conditions[key];

      //check if there's a subcondition
      if ( subConditionsArray.hasOwnProperty( 'relation' ) ) {
        thisConditionApplies = 1 === validateConditions( subConditionsArray, fields, fieldId, true );
        if ( 'AND' === relation ) {
          conditionApplies = conditionApplies && thisConditionApplies;
        } else {
          conditionApplies = conditionApplies || thisConditionApplies;
        }
      }
      for ( let conditionField in subConditionsArray ) {
        if ( 'hidden' === conditionField ) {
          thisConditionApplies = false;
          continue;
        }
        let invert = 0 === conditionField.indexOf( '!' );
        if ( subConditionsArray.hasOwnProperty( conditionField ) ) {
          let conditionValue = subConditionsArray[conditionField];
          conditionField = conditionField.replace( '!', '' );
          let conditionFields = fields.filter( field => field.id === conditionField );

          if ( conditionFields.hasOwnProperty( 0 ) ) {
            let field = conditionFields[0];
            let actualValue = field.value;

            if ( 'text_checkbox' === field.type ) {
              thisConditionApplies = actualValue.hasOwnProperty( 'show' ) && actualValue.show == conditionValue;
            } else if ( 'checkbox' === field.type ) {
              thisConditionApplies = actualValue == conditionValue; //with == it can be either true or 1
            } else if ( 'multicheckbox' === field.type ) {

              //multicheckbox conditions
              //loop through objects
              thisConditionApplies = false;
              let arrayValue = actualValue;
              if ( ! Array.isArray( arrayValue ) ) {
                arrayValue = '' !== arrayValue ? [] : [ arrayValue ];
              }
              if ( 0 === arrayValue.length ) {
                thisConditionApplies = false;
              } else {
                for ( const key of Object.keys( arrayValue ) ) {
                  if ( ! Array.isArray( conditionValue ) ) {
conditionValue = [ conditionValue ];
}
                  if ( conditionValue.includes( arrayValue[key]) ) {
                    thisConditionApplies = true;
                    break;
                  }
                }
              }
            } else if ( 'radio' === field.type || 'document' === field.type ) {

              //as the regions field can be both radio and multicheckbox, an array is possible for a radio field
              if ( Array.isArray( conditionValue ) ) {
                thisConditionApplies = conditionValue.includes( actualValue );
              } else {
                thisConditionApplies = conditionValue === actualValue;
              }
            } else {
              if ( true === conditionValue ) {
                thisConditionApplies = 1 === actualValue || '1' === actualValue || true === actualValue;
              } else if ( false === conditionValue ) {
                thisConditionApplies = 0 === actualValue || '0' === actualValue || false === actualValue;
              } else if ( -1 !== conditionValue.indexOf( 'EMPTY' ) ) {
                thisConditionApplies = 0 === actualValue.length;
              } else if ( Array.isArray( conditionValue ) ) {
                thisConditionApplies = conditionValue.includes( actualValue );
              } else {
                thisConditionApplies = String( actualValue ).toLowerCase() === conditionValue.toLowerCase();
              }
            }
          }
        }
        if ( invert ) {
          thisConditionApplies = ! thisConditionApplies;
        }
        if ( 'AND' === relation ) {
          conditionApplies = conditionApplies && thisConditionApplies;
        } else {
          conditionApplies = conditionApplies || thisConditionApplies;
        }
      }
      if ( 'AND' === relation ) {
        conditionApplies = conditionApplies && thisConditionApplies;
      } else {
        conditionApplies = conditionApplies || thisConditionApplies;
      }
    }
  }

  return conditionApplies ? 1 : 0;
};
