import { createElement } from '@wordpress/element';
export var Button = function (_a) {
    var _b = _a.variant, variant = _b === void 0 ? 'primary' : _b, _c = _a.size, size = _c === void 0 ? 'md' : _c, children = _a.children, onClick = _a.onClick, _d = _a.disabled, disabled = _d === void 0 ? false : _d;
    var baseStyles = 'rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
    var variants = {
        primary: 'bg-primary text-white hover:bg-primary-dark focus:ring-primary',
        secondary: 'bg-secondary text-black hover:bg-secondary-dark focus:ring-secondary',
        accent: 'bg-accent text-white hover:bg-accent-dark focus:ring-accent',
    };
    var sizes = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg',
    };
    return createElement('button', {
        className: "".concat(baseStyles, " ").concat(variants[variant], " ").concat(sizes[size], " ").concat(disabled ? 'opacity-50 cursor-not-allowed' : ''),
        onClick: disabled ? undefined : onClick,
        disabled: disabled,
    }, children);
};
