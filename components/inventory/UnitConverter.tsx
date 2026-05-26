'use client';

import { useState } from 'react';
import { ArrowRight, Calculator } from 'lucide-react';

interface ConversionRule {
  from: string;
  to: string;
  factor: number;
}

const conversionRules: ConversionRule[] = [
  { from: 'Each', to: 'Box', factor: 12 },
  { from: 'Box', to: 'Case', factor: 10 },
  { from: 'Case', to: 'Pallet', factor: 48 },
  { from: 'Kg', to: 'L', factor: 0.8 },
  { from: 'L', to: 'Kg', factor: 1.25 },
];

export default function UnitConverter() {
  const [fromUnit, setFromUnit] = useState('Each');
  const [toUnit, setToUnit] = useState('Box');
  const [fromValue, setFromValue] = useState('');
  const [toValue, setToValue] = useState('');

  const units = ['Each', 'Box', 'Case', 'Pallet', 'Kg', 'L'];

  const findConversionFactor = (from: string, to: string): number | null => {
    if (from === to) return 1;
    const rule = conversionRules.find((r) => r.from === from && r.to === to);
    return rule ? rule.factor : null;
  };

  const handleFromChange = (value: string) => {
    setFromValue(value);
    const factor = findConversionFactor(fromUnit, toUnit);
    if (factor && value) {
      setToValue((parseFloat(value) * factor).toFixed(2));
    } else {
      setToValue('');
    }
  };

  const handleToChange = (value: string) => {
    setToValue(value);
    const factor = findConversionFactor(fromUnit, toUnit);
    if (factor && value) {
      setFromValue((parseFloat(value) / factor).toFixed(2));
    } else {
      setFromValue('');
    }
  };

  const handleFromUnitChange = (unit: string) => {
    setFromUnit(unit);
    const factor = findConversionFactor(unit, toUnit);
    if (factor && fromValue) {
      setToValue((parseFloat(fromValue) * factor).toFixed(2));
    } else {
      setToValue('');
    }
  };

  const handleToUnitChange = (unit: string) => {
    setToUnit(unit);
    const factor = findConversionFactor(fromUnit, unit);
    if (factor && fromValue) {
      setToValue((parseFloat(fromValue) * factor).toFixed(2));
    } else {
      setToValue('');
    }
  };

  const swapUnits = () => {
    const temp = fromUnit;
    setFromUnit(toUnit);
    setToUnit(temp);
    const tempValue = fromValue;
    setFromValue(toValue);
    setToValue(tempValue);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Unit Converter</h3>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
            <select
              value={fromUnit}
              onChange={(e) => handleFromUnitChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              {units.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
            <select
              value={toUnit}
              onChange={(e) => handleToUnitChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              {units.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <input
              type="number"
              value={fromValue}
              onChange={(e) => handleFromChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-lg"
              placeholder="0"
            />
          </div>

          <button
            type="button"
            onClick={swapUnits}
            className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowRight className="h-5 w-5 text-gray-600" />
          </button>

          <div className="flex-1">
            <input
              type="number"
              value={toValue}
              onChange={(e) => handleToChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-lg"
              placeholder="0"
            />
          </div>
        </div>

        {/* Conversion Info */}
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Conversion:</span> 1 {fromUnit} = {findConversionFactor(fromUnit, toUnit) || 'N/A'} {toUnit}
          </p>
        </div>

        {/* Available Conversions */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Available Conversions:</p>
          <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
            {conversionRules.map((rule, index) => (
              <div key={index} className="bg-gray-50 px-3 py-2 rounded">
                1 {rule.from} = {rule.factor} {rule.to}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
