'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  VALUE_ADDED_SERVICES,
  ValueAddedService,
  calculateValueAddedServicesTotal
} from '@/lib/value-added-services';

export function ValueAddedServicesSelector() {
  const [services, setServices] = useState<ValueAddedService[]>(
    VALUE_ADDED_SERVICES.map(s => ({ ...s }))
  );

  const toggleService = (serviceId: string) => {
    const updatedServices = services.map(service => {
      if (service.id === serviceId) {
        return { ...service, selected: !service.selected };
      }
      return service;
    });
    
    setServices(updatedServices);
  };

  const selectedCount = services.filter(s => s.selected).length;
  const totalPrice = calculateValueAddedServicesTotal(services);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">增值服务</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              已选 {selectedCount} 项
            </Badge>
            <Badge className="bg-green-600">
              合计 ¥{totalPrice.toLocaleString()}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {services.map((service) => (
            <div
              key={service.id}
              className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                service.selected 
                  ? 'border-blue-200 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Checkbox
                id={service.id}
                checked={service.selected}
                onCheckedChange={() => toggleService(service.id)}
                className="mt-1"
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor={service.id}
                    className={`font-medium cursor-pointer ${
                      service.selected ? 'text-blue-700' : 'text-gray-900'
                    }`}
                  >
                    {service.name}
                  </Label>
                  <span className="text-sm font-semibold text-blue-600">
                    ¥{service.price.toLocaleString()}/年
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {service.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
