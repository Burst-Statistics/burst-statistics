import Icon from '../../utils/Icon';
import HelpTooltip from '@/components/Common/HelpTooltip';

const ExplanationAndStatsItem = ({
  iconKey,
  title,
  subtitle,
  value,
  exactValue,
  change,
  changeStatus
}) => {
  const tooltipValue = 1000 < exactValue ? exactValue : false;
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon name={iconKey} className="mt-1" />
      <div className="flex-1">
        <h3 className="text-base font-semibold text-black">{title}</h3>
        <p className="text-sm text-gray">{subtitle}</p>
      </div>
      <div className="text-right">
        <HelpTooltip content={tooltipValue} delayDuration={1000}>
          <span className="text-xl font-bold text-black">{value}</span>
        </HelpTooltip>
        <p
          className={`text-sm ${'positive' === changeStatus ? 'text-green' : 'text-red'}`}
        >
          {change}
        </p>
      </div>
    </div>
  );
};

export default ExplanationAndStatsItem;
