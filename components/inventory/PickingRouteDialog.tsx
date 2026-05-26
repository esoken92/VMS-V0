'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, ArrowRight, CheckCircle } from 'lucide-react';

interface PickingRouteDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface PickItem {
  id: string;
  product_name: string;
  sku: string;
  quantity: number;
  bin_location: string;
  zone: string;
  picked: boolean;
}

export default function PickingRouteDialog({ open, onClose, onSuccess }: PickingRouteDialogProps) {
  const [pickItems, setPickItems] = useState<PickItem[]>([
    { id: '1', product_name: 'Brake Pad Set', sku: 'BRK-001', quantity: 5, bin_location: 'Zone-A-01', zone: 'A', picked: false },
    { id: '2', product_name: 'Oil Filter', sku: 'FLT-002', quantity: 10, bin_location: 'Zone-A-05', zone: 'A', picked: false },
    { id: '3', product_name: 'Air Filter', sku: 'AIR-003', quantity: 3, bin_location: 'Zone-B-02', zone: 'B', picked: false },
    { id: '4', product_name: 'Spark Plug', sku: 'SPK-004', quantity: 8, bin_location: 'Zone-B-08', zone: 'B', picked: false },
  ]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);

  const handlePick = (itemId: string) => {
    setPickItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, picked: !item.picked } : item
      )
    );
  };

  const handleNext = () => {
    if (currentStep < pickItems.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      // Simulate API call to complete pick
      await new Promise((resolve) => setTimeout(resolve, 1000));
      onSuccess();
      onClose();
      setCurrentStep(0);
      setPickItems([
        { id: '1', product_name: 'Brake Pad Set', sku: 'BRK-001', quantity: 5, bin_location: 'Zone-A-01', zone: 'A', picked: false },
        { id: '2', product_name: 'Oil Filter', sku: 'FLT-002', quantity: 10, bin_location: 'Zone-A-05', zone: 'A', picked: false },
        { id: '3', product_name: 'Air Filter', sku: 'AIR-003', quantity: 3, bin_location: 'Zone-B-02', zone: 'B', picked: false },
        { id: '4', product_name: 'Spark Plug', sku: 'SPK-004', quantity: 8, bin_location: 'Zone-B-08', zone: 'B', picked: false },
      ]);
    } catch (error) {
      console.error('Error completing pick:', error);
    } finally {
      setIsCompleting(false);
    }
  };

  const allPicked = pickItems.every((item) => item.picked);
  const currentItem = pickItems[currentStep];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Optimized Picking Route</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Step {currentStep + 1} of {pickItems.length}
            </p>
            <p className="text-sm font-medium text-gray-900">
              {pickItems.filter((item) => item.picked).length} / {pickItems.length} picked
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${((currentStep + 1) / pickItems.length) * 100}%` }}
            />
          </div>

          {/* Current Pick Item */}
          {currentItem && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <MapPin className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-blue-600 font-medium">Zone {currentItem.zone}</p>
                    <p className="text-lg font-bold text-gray-900">{currentItem.bin_location}</p>
                  </div>
                </div>
                <button
                  onClick={() => handlePick(currentItem.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                    currentItem.picked
                      ? 'bg-green-100 text-green-700'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {currentItem.picked ? (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      Picked
                    </>
                  ) : (
                    'Mark as Picked'
                  )}
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-lg font-semibold text-gray-900">{currentItem.product_name}</p>
                <p className="text-sm text-gray-600">SKU: {currentItem.sku}</p>
                <p className="text-sm text-gray-600">Quantity to pick: <span className="font-bold">{currentItem.quantity}</span></p>
              </div>
            </div>
          )}

          {/* Route Overview */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-900 mb-3">Route Overview</p>
            <div className="space-y-2">
              {pickItems.map((item, index) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-2 rounded-lg ${
                    index === currentStep
                      ? 'bg-blue-100 border border-blue-300'
                      : item.picked
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-white border border-gray-200'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    item.picked
                      ? 'bg-green-600 text-white'
                      : index === currentStep
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{item.product_name}</p>
                    <p className="text-xs text-gray-600">{item.bin_location} × {item.quantity}</p>
                  </div>
                  {item.picked && <CheckCircle className="h-4 w-4 text-green-600" />}
                </div>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              Previous
            </Button>

            {currentStep < pickItems.length - 1 ? (
              <Button type="button" onClick={handleNext}>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleComplete}
                disabled={!allPicked || isCompleting}
              >
                {isCompleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Completing...
                  </>
                ) : (
                  'Complete Pick'
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
