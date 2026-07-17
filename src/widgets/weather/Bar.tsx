import { useEffect, useState } from 'react';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { 
    SunIcon, CloudSunIcon, CloudIcon, CloudFogIcon, 
    CloudDrizzleIcon, CloudRainIcon, CloudSnowIcon, 
    CloudLightningIcon, MoonIcon
} from 'lucide-react';

const getWeatherDetails = (code: number, isDay: boolean = true) => {
    switch (code) {
        case 0: return { Icon: isDay ? SunIcon : MoonIcon };
        case 1: 
        case 2: 
        case 3: return { Icon: isDay ? CloudSunIcon : CloudIcon };
        case 45: 
        case 48: return { Icon: CloudFogIcon };
        case 51: case 53: case 55: case 56: case 57: return { Icon: CloudDrizzleIcon };
        case 61: case 63: case 65: case 66: case 67: 
        case 80: case 81: case 82: return { Icon: CloudRainIcon };
        case 71: case 73: case 75: case 77: 
        case 85: case 86: return { Icon: CloudSnowIcon };
        case 95: case 96: case 99: return { Icon: CloudLightningIcon };
        default: return { Icon: isDay ? SunIcon : MoonIcon };
    }
};

export default function WeatherBar({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const settings = useSettingsStore(state => state.settings) || {};
    
    const [weatherData, setWeatherData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const lat = config.lat || 51.5085;
    const lon = config.lon || -0.1257;
    const useFahrenheit = config.useFahrenheit ?? false;
    const disableClickPopup = config.disableClickPopup ?? false;
    
    const barHeight = settings.barHeight || 36;
    const isLarge = barHeight >= 48;
    const showCityName = config.showCityName ?? false;
    const currentCity = config.cityName || 'London';

    useEffect(() => {
        let isMounted = true;
        const fetchWeather = async () => {
            try {
                setLoading(true);
                const tempUnit = useFahrenheit ? 'fahrenheit' : 'celsius';
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,is_day,weather_code&timezone=auto&temperature_unit=${tempUnit}`;
                
                const res = await fetch(url);
                const data = await res.json();
                
                if (isMounted) {
                    setWeatherData(data);
                    setLoading(false);
                }
            } catch (e) {
                if (isMounted) setLoading(false);
            }
        };

        fetchWeather();
        const interval = setInterval(fetchWeather, 30 * 60 * 1000); // 30 mins
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [lat, lon, useFahrenheit]);

    const handleRootClick = (e: any) => {
        if (disableClickPopup) {
            e.stopPropagation();
        }
    };

    if (loading || !weatherData) {
        return (
            <div onClick={handleRootClick} className="text-white/70 text-sm font-medium flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" style={{cornerShape: 'round'}} />
            </div>
        );
    }

    const current = weatherData.current;
    const { Icon } = getWeatherDetails(current.weather_code, current.is_day === 1);
    const temp = Math.round(current.temperature_2m);

    if (isLarge) {
        return (
            <div onClick={handleRootClick} className="text-white flex flex-col items-center justify-center leading-none select-none">
                <span className="text-sm font-semibold tracking-wide flex items-center gap-1">
                    <Icon className="w-3.5 h-3.5 text-white/90" />
                    {temp}°
                </span>
                {showCityName && (
                    <span className="text-[10px] text-white/70 font-normal leading-none mt-1">{currentCity}</span>
                )}
            </div>
        );
    }

    return (
        <div onClick={handleRootClick} className="text-white text-sm font-medium tracking-wide flex items-center gap-1.5 select-none">
            <Icon className="w-4 h-4 text-white/90" />
            <span>{temp}°</span>
            {showCityName && (
                <span className="text-xs text-white/80 font-normal">{currentCity}</span>
            )}
        </div>
    );
}
