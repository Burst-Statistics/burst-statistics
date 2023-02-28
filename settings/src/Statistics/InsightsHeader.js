import { __ } from '@wordpress/i18n';
import {
  Component,
    useRef
} from 'react';
import Icon from '../utils/Icon';
import {Button} from '@wordpress/components';
import {Popover} from '@mui/material';
import {useInsightsStats} from '../data/statistics/insights';

const InsightsHeader = (props) => {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const {insightsMetrics, setInsightsMetrics} = useInsightsStats(state => state);
  const refMetrics = useRef(insightsMetrics ? [...insightsMetrics] : []);
  const availableMetrics = ['visitors', 'pageviews', 'bounces', 'sessions']
  const metricLabels = {
    visitors: __('Unique visitors', 'burst-statistics'),
    pageviews: __('Pageviews', 'burst-statistics'),
    bounces: __('Bounces', 'burst-statistics'),
    sessions: __('Sessions', 'burst-statistics'),
  }
  const open = Boolean(anchorEl);

  const handleClick = (e) => {
    setAnchorEl(e.currentTarget);
  };

  const handleClose = (e) => {
    // save metrics
    setInsightsMetrics(refMetrics.current);
    e.preventDefault();
    setAnchorEl(null);
  };

  const changeMetric = (e) => {
    // save metric as ref
    const metric = e.target.value;
    if (refMetrics.current.includes(metric)) {
      // remove metric
      const index = refMetrics.current.indexOf(metric);
      if (index > -1) {
        refMetrics.current.splice(index, 1);
      }
    } else {
      // add metric
      refMetrics.current.push(metric);
    }
  };

  return (
      <div>
        <Button
            id="burst-filter-button"
            className={"burst-filter-button" + (open ? ' active' : '')}
            aria-controls={open ? 'burst-filter-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={open ? 'true' : undefined}
            onClick={handleClick}
        >
          <Icon name='filter' />
        </Button>
        <Popover
            id="burst-filter-menu"
            className="burst burst-filter-menu"
            anchorEl={anchorEl}
            anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
            transformOrigin={{vertical: 'top', horizontal: 'right'}}
            open={open}
            onClose={handleClose}
        >
          <h4>{__('Select metrics', 'burst-statistics')}</h4>
          {availableMetrics.map((metric, index) => {
                return (
                    <div className="burst-filter-dropdown-content-body-item" key={index}>
                      <input type="checkbox" id={metric} name={metric} value={metric} defaultChecked={insightsMetrics.includes(metric)} onChange={changeMetric} />
                      <label htmlFor={metric}>{metricLabels[metric]}</label>
                    </div>
                )
              }
          )}
          <input type="hidden" name="burst-metrics" value={insightsMetrics} />
          <Button onClick={handleClose} className="button button-secondary">{__('Apply', 'burst-statistics')}</Button>
        </Popover>
      </div>
  );
}

export default InsightsHeader;