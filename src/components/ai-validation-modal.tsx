import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cpcData } from '@/lib/cpc-data';

interface AIValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  onConfirm: (data: any) => void;
}

export function AIValidationModal({ isOpen, onClose, data, onConfirm }: AIValidationModalProps) {
  const [formData, setFormData] = useState<any>(data || {});

  useEffect(() => {
    if (isOpen) {
      setFormData(data || {});
    }
  }, [isOpen, data]);

  const handleChange = (path: string, value: any) => {
    setFormData((prev: any) => {
      const newData = { ...prev };
      const keys = path.split('.');
      let current = newData;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  const handleConfirm = () => {
    onConfirm(formData);
  };

  const isInvalid = (val: any) => {
    return val === null || val === undefined || val === '' || val === 0 || val === '0';
  };

  const isInvalidDropdown = (val: any, options: string[]) => {
    if (isInvalid(val)) return true;
    return !options.includes(val);
  };

  if (!isOpen) return null;

  const payLevels = cpcData['7th'].payLevels.map((l: any) => l.level);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Verify AI Data</DialogTitle>
          <DialogDescription>
            Please verify the data extracted from the Pay Fixation. Missing or invalid fields are highlighted in red.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Employee Details */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="text-base font-semibold mb-2 border-b border-blue-200 pb-1 text-blue-900">Employee Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="employeeName">Name</Label>
                <Input 
                  id="employeeName" 
                  value={formData.employeeName || ''} 
                  onChange={(e) => handleChange('employeeName', e.target.value)}
                  className={isInvalid(formData.employeeName) ? 'border-red-500 bg-white' : 'bg-white'}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="employeeId">ID No.</Label>
                <Input 
                  id="employeeId" 
                  value={formData.employeeId || ''} 
                  onChange={(e) => handleChange('employeeId', e.target.value)}
                  className={isInvalid(formData.employeeId) ? 'border-red-500 bg-white' : 'bg-white'}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="designation">Designation</Label>
                <Input 
                  id="designation" 
                  value={formData.designation || ''} 
                  onChange={(e) => handleChange('designation', e.target.value)}
                  className={isInvalid(formData.designation) ? 'border-red-500 bg-white' : 'bg-white'}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="department">Department</Label>
                <Input 
                  id="department" 
                  value={formData.department || ''} 
                  onChange={(e) => handleChange('department', e.target.value)}
                  className={isInvalid(formData.department) ? 'border-red-500 bg-white' : 'bg-white'}
                />
              </div>
            </div>
          </div>

          {/* Pay Fixation Info */}
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <h3 className="text-base font-semibold mb-2 border-b border-purple-200 pb-1 text-purple-900">Fixation Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="fromDate">Effective Date (From)</Label>
                <Input 
                  id="fromDate" 
                  type="date"
                  value={formData.fromDate || ''} 
                  onChange={(e) => handleChange('fromDate', e.target.value)}
                  className={isInvalid(formData.fromDate) ? 'border-red-500 bg-white' : 'bg-white'}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="payFixationRef">Reference No. & Date</Label>
                <Input 
                  id="payFixationRef" 
                  value={formData.payFixationRef || ''} 
                  onChange={(e) => handleChange('payFixationRef', e.target.value)}
                  className={isInvalid(formData.payFixationRef) ? 'border-red-500 bg-white' : 'bg-white'}
                />
              </div>
            </div>
          </div>

          {/* Already Paid */}
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <h3 className="text-base font-semibold mb-2 border-b border-orange-200 pb-1 text-orange-900">Existing Pay (Already Paid)</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="paid.payLevel">Level</Label>
                <Select value={formData.paid?.payLevel || ''} onValueChange={(val) => handleChange('paid.payLevel', val)}>
                  <SelectTrigger className={isInvalidDropdown(formData.paid?.payLevel, payLevels) ? 'border-red-500 bg-white' : 'bg-white'}>
                    <SelectValue placeholder="Select Level" />
                  </SelectTrigger>
                  <SelectContent>
                    {payLevels.map((lvl: string) => (
                      <SelectItem key={lvl} value={lvl}>Level {lvl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="paid.basicPay">Basic Pay</Label>
                <Input 
                  id="paid.basicPay" 
                  type="number"
                  value={formData.paid?.basicPay || ''} 
                  onChange={(e) => handleChange('paid.basicPay', parseFloat(e.target.value) || 0)}
                  className={isInvalid(formData.paid?.basicPay) ? 'border-red-500 bg-white' : 'bg-white'}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="paid.incrementMonth">Increment Month</Label>
                <Input 
                  id="paid.incrementMonth" 
                  value={formData.paid?.incrementMonth || ''} 
                  onChange={(e) => handleChange('paid.incrementMonth', e.target.value)}
                  className={isInvalid(formData.paid?.incrementMonth) ? 'border-red-500 bg-white' : 'bg-white'}
                />
              </div>
            </div>
          </div>

          {/* To Be Paid */}
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h3 className="text-base font-semibold mb-2 border-b border-green-200 pb-1 text-green-900">Revised Pay (To Be Paid)</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="toBePaid.payLevel">Level</Label>
                <Select value={formData.toBePaid?.payLevel || ''} onValueChange={(val) => handleChange('toBePaid.payLevel', val)}>
                  <SelectTrigger className={isInvalidDropdown(formData.toBePaid?.payLevel, payLevels) ? 'border-red-500 bg-white' : 'bg-white'}>
                    <SelectValue placeholder="Select Level" />
                  </SelectTrigger>
                  <SelectContent>
                    {payLevels.map((lvl: string) => (
                      <SelectItem key={lvl} value={lvl}>Level {lvl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="toBePaid.basicPay">Basic Pay</Label>
                <Input 
                  id="toBePaid.basicPay" 
                  type="number"
                  value={formData.toBePaid?.basicPay || ''} 
                  onChange={(e) => handleChange('toBePaid.basicPay', parseFloat(e.target.value) || 0)}
                  className={isInvalid(formData.toBePaid?.basicPay) ? 'border-red-500 bg-white' : 'bg-white'}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="toBePaid.incrementMonth">Increment Month</Label>
                <Input 
                  id="toBePaid.incrementMonth" 
                  value={formData.toBePaid?.incrementMonth || ''} 
                  onChange={(e) => handleChange('toBePaid.incrementMonth', e.target.value)}
                  className={isInvalid(formData.toBePaid?.incrementMonth) ? 'border-red-500 bg-white' : 'bg-white'}
                />
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="toBePaid.refixedBasicPay">Re-fixed Basic Pay</Label>
                <Input 
                  id="toBePaid.refixedBasicPay" 
                  type="number"
                  value={formData.toBePaid?.refixedBasicPay || ''} 
                  onChange={(e) => handleChange('toBePaid.refixedBasicPay', parseFloat(e.target.value) || 0)}
                  className={isInvalid(formData.toBePaid?.refixedBasicPay) ? 'border-yellow-500 bg-yellow-50' : 'bg-white'}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="toBePaid.refixedBasicPayDate">Re-fixed Date</Label>
                <Input 
                  id="toBePaid.refixedBasicPayDate" 
                  type="date"
                  value={formData.toBePaid?.refixedBasicPayDate || ''} 
                  onChange={(e) => handleChange('toBePaid.refixedBasicPayDate', e.target.value)}
                  className={isInvalid(formData.toBePaid?.refixedBasicPayDate) ? 'border-yellow-500 bg-yellow-50' : 'bg-white'}
                />
              </div>
            </div>
            <p className="text-xs text-green-700/80 mt-2 font-medium leading-none">
              * Leave Re-fixed Basic Pay and Date empty if no re-fixation exists in Section 12(a)
            </p>
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm}>Confirm & Calculate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
