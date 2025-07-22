import React, { useState, useEffect, useCallback } from "react";
import { useQueryContext } from "../context/QueryContext";

interface SliderProps {
  min: number;
  max: number;
  name: string;
  title?: string;
  size?: "full" | "half";
  defaultValue?: number;
}

export const Slider: React.FC<SliderProps> = React.memo(
  ({ min, max, name, title, size = "half", defaultValue }) => {
    const { inputParams, setInputParam } = useQueryContext();

    const initialValue =
      inputParams[name] !== undefined
        ? Number(inputParams[name])
        : defaultValue !== undefined
        ? defaultValue
        : min;
    const [currentValue, setCurrentValue] = useState<number>(initialValue);

    // Update internal state if inputParams change from outside (e.g., initial load or MDX re-render)
    useEffect(() => {
      if (
        inputParams[name] !== undefined &&
        Number(inputParams[name]) !== currentValue
      ) {
        setCurrentValue(Number(inputParams[name]));
      }
    }, [inputParams, name, currentValue]);

    // Set initial value in context if not already set
    useEffect(() => {
      if (inputParams[name] === undefined) {
        setInputParam(name, initialValue);
      }
    }, [name, initialValue, inputParams, setInputParam]);

    const handleChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = Number(event.target.value);
        setCurrentValue(newValue);
        setInputParam(name, newValue);
      },
      [name, setInputParam]
    );

    const widthClass = size === "full" ? "w-full" : "w-1/2";

    return (
      <div
        className={`my-4 p-4 bg-white rounded-lg shadow-sm border border-gray-200 ${widthClass}`}
      >
        {title && (
          <label
            htmlFor={name}
            className="block text-lg font-medium text-gray-700 mb-2"
          >
            {title}
          </label>
        )}
        <div className="flex items-center space-x-4">
          <input
            type="range"
            id={name}
            name={name}
            min={min}
            max={max}
            value={currentValue}
            onChange={handleChange}
            className="flex-grow h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <span className="text-gray-800 font-semibold text-xl">
            {currentValue}
          </span>
        </div>
      </div>
    );
  }
);
