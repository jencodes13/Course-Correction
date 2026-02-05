import React, { useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

interface LocationInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const LocationInput: React.FC<LocationInputProps> = ({
  value,
  onChange,
  placeholder = "e.g. Austin, TX or London, UK",
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleGeoLocation = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation not supported by your browser');
      return;
    }

    setIsLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;

        try {
          // Use free OpenStreetMap Nominatim API for reverse geocoding
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
            { headers: { 'User-Agent': 'CourseCorrect-App' } }
          );
          const data = await response.json();

          // Extract city, state, and postal code
          const addr = data.address || {};
          const city = addr.city || addr.town || addr.village || addr.municipality || '';
          const state = addr.state || addr.region || '';
          const zip = addr.postcode || '';

          // Format as "City, State ZIP"
          let location = city;
          if (state) location += location ? `, ${state}` : state;
          if (zip) location += ` ${zip}`;

          onChange(location || data.display_name?.split(',').slice(0, 2).join(',') || `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
        } catch (e) {
          console.error('Reverse geocoding failed:', e);
          onChange(`${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
        }

        setIsLoading(false);
      },
      (err) => {
        console.error('Geolocation error:', err);
        setIsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          alert('Location access denied. Please type your location manually.');
        }
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
      />
      <button
        type="button"
        onClick={handleGeoLocation}
        disabled={isLoading}
        className="bg-indigo-50 text-indigo-600 p-3 rounded-xl hover:bg-indigo-100 transition-colors disabled:opacity-50"
        title="Detect Current Location"
      >
        {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <MapPin className="w-6 h-6" />}
      </button>
    </div>
  );
};

export default LocationInput;
