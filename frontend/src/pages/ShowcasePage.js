import React from 'react';
import ComponentShowcase from '../shared/ComponentShowcase';

export default function ShowcasePage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-3xl font-black tracking-tight">UI Showcase</div>
        <div className="text-sm text-gray-400 font-medium">Buttons, switches and animations</div>
      </div>
      <ComponentShowcase />
    </div>
  );
}
