type ColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
};

const PRESET_COLORS = ['#22C55E', '#0EA5E9', '#F97316', '#A855F7', '#EC4899', '#64748B'];

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Set Color</label>
      <div className="flex gap-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={`w-10 h-10 rounded-full border-2 transition-all ${
              value === color ? 'border-gray-900 scale-110' : 'border-gray-300 hover:border-gray-400'
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
    </div>
  );
}
