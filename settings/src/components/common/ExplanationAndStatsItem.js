import Icon from '../../utils/Icon';
import Tooltip from '../common/Tooltip';

const ExplanationAndStatsItem = ({ iconKey, title, subtitle, value, exactValue, change, changeStatus }) => {

  const tooltipValue = 1000 <  exactValue  ? exactValue : false;
  return (
      <div className="block__explanation-and-stats">
        <Icon name={iconKey} />
        <div className="block__explanation-and-stats__left">
          <h3 className="burst-h5">{title}</h3>
          <p>{subtitle}</p>
        </div>
        <div className="block__explanation-and-stats__right">
          <Tooltip content={tooltipValue} delayDuration={1000}>
            <span className="burst-h4">{value}</span>
          </Tooltip>
          <p className={'uplift ' + changeStatus}>{change}</p>
        </div>
      </div>
  );
};

export default ExplanationAndStatsItem;
