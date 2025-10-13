const ProgressBar = ({ currentStep, totalSteps }) => {
    const progressPercentage = ((currentStep + 1) / totalSteps) * 100;

    return (
        <div className="w-full max-w-[20%]">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                    className="bg-blue h-2.5 rounded-full transition-all duration-300 ease-in-out"
                    style={{ width: `${progressPercentage}%` }}
                ></div>
            </div>
        </div>
    );
};

export default ProgressBar; 