import { useEffect, useRef, useState } from 'react';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { 
    SunIcon, CloudSunIcon, CloudIcon, CloudFogIcon, 
    CloudDrizzleIcon, CloudRainIcon, CloudSnowIcon, 
    CloudLightningIcon, MoonIcon, WindIcon, DropletsIcon
} from 'lucide-react';

// WMO Weather interpretation codes (https://open-meteo.com/en/docs)
const getWeatherDetails = (code: number, isDay: boolean = true) => {
    switch (code) {
        case 0: return { label: 'Clear sky', Icon: isDay ? SunIcon : MoonIcon };
        case 1: 
        case 2: 
        case 3: return { label: 'Partly cloudy', Icon: isDay ? CloudSunIcon : CloudIcon };
        case 45: 
        case 48: return { label: 'Fog', Icon: CloudFogIcon };
        case 51: case 53: case 55: case 56: case 57: return { label: 'Drizzle', Icon: CloudDrizzleIcon };
        case 61: case 63: case 65: case 66: case 67: 
        case 80: case 81: case 82: return { label: 'Rain', Icon: CloudRainIcon };
        case 71: case 73: case 75: case 77: 
        case 85: case 86: return { label: 'Snow', Icon: CloudSnowIcon };
        case 95: case 96: case 99: return { label: 'Thunderstorm', Icon: CloudLightningIcon };
        default: return { label: 'Unknown', Icon: isDay ? SunIcon : MoonIcon };
    }
};

export default function WeatherArea({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const [weatherData, setWeatherData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const startX = useRef(0);
    const scrollLeft = useRef(0);

    const [dimensions, setDimensions] = useState({ width: 300, height: 150 });
    const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!containerElement) return;
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                setDimensions({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height
                });
            }
        });
        observer.observe(containerElement);
        return () => observer.disconnect();
    }, [containerElement]);

    const [error, setError] = useState(false);
    const useFahrenheit = config.useFahrenheit ?? false;
    const currentCity = config.cityName || 'London';
    const lat = config.lat || 51.5085;
    const lon = config.lon || -0.1257;

    useEffect(() => {
        let isMounted = true;
        const fetchWeather = async () => {
            setLoading(true);
            setError(false);
            try {
                const tempUnit = useFahrenheit ? 'fahrenheit' : 'celsius';
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&temperature_unit=${tempUnit}`;
                
                const res = await fetch(url);
                const data = await res.json();
                
                if (isMounted) {
                    setWeatherData(data);
                    setLoading(false);
                }
            } catch (e) {
                if (isMounted) {
                    setError(true);
                    setLoading(false);
                }
            }
        };

        fetchWeather();
        // Refresh every 30 minutes
        const interval = setInterval(fetchWeather, 30 * 60 * 1000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [lat, lon, useFahrenheit]);

    if (loading) {
        return (
            <div ref={setContainerElement} className="w-full h-full flex items-center justify-center pointer-events-none text-zinc-800 dark:text-zinc-100">
                <div className="animate-pulse flex flex-col items-center">
                    <CloudIcon className="w-8 h-8 opacity-50 mb-2" />
                    <div className="h-2 w-16 bg-zinc-300 dark:bg-zinc-700 rounded-full"></div>
                </div>
            </div>
        );
    }

    if (error || !weatherData) {
        return (
            <div ref={setContainerElement} className="w-full h-full flex flex-col items-center justify-center text-red-500 text-xs pointer-events-none">
                <span>Failed to load</span>
                <span>weather data</span>
            </div>
        );
    }

    const current = weatherData.current;
    const daily = weatherData.daily;
    const { label, Icon } = getWeatherDetails(current.weather_code, current.is_day === 1);
    
    // Determine layout based on dimensions
    const isSmall = dimensions.width < 130 || dimensions.height < 90;
    const showForecast = (config.showForecast ?? true) && dimensions.height >= 190 && dimensions.width >= 180;
    const showDetails = dimensions.width >= 240 && dimensions.height >= 130;

    const forecastDays = [1, 2, 3, 4, 5, 6];

    const handleWheel = (e: React.WheelEvent) => {
        if (scrollRef.current) {
            scrollRef.current.scrollLeft += e.deltaY;
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        isDragging.current = true;
        startX.current = e.pageX - scrollRef.current.offsetLeft;
        scrollLeft.current = scrollRef.current.scrollLeft;
    };

    const handleMouseLeave = () => {
        isDragging.current = false;
    };

    const handleMouseUp = () => {
        isDragging.current = false;
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current || !scrollRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - startX.current);
        scrollRef.current.scrollLeft = scrollLeft.current - walk;
    };

    return (
        <div ref={setContainerElement} className="w-full h-full text-zinc-800 dark:text-zinc-100 p-3 md:p-4 flex flex-col justify-between overflow-hidden relative pointer-events-none">
            {/* Background Icon (decorative) */}
            <Icon className="absolute -right-6 -top-6 w-32 h-32 opacity-5" />

            <div className="flex justify-between items-start z-10">
                <div className="flex flex-col">
                    {!isSmall && (
                        <span className="font-semibold text-sm tracking-wide opacity-90 drop-shadow-sm line-clamp-1">{currentCity}</span>
                    )}
                    {(showDetails || (!isSmall && !showForecast)) && (
                        <span className="text-xs opacity-75 font-medium">{label}</span>
                    )}
                    {(!showDetails && showForecast && !isSmall) && (
                         <span className="text-xs opacity-75 font-medium">{label}</span>
                    )}
                </div>
                {!isSmall && <Icon className="w-6 h-6 opacity-90 drop-shadow-sm" />}
            </div>

            <div className={`flex ${isSmall ? 'flex-col items-center justify-center h-full gap-1' : 'items-end justify-between'} z-10 mt-auto`}>
                <div className="flex items-start">
                    {isSmall && <Icon className="w-6 h-6 opacity-90 drop-shadow-sm" />}
                    <span className={`${isSmall ? 'text-3xl' : 'text-5xl'} font-bold tracking-tighter leading-none drop-shadow-md`}>
                        {Math.round(current.temperature_2m)}°
                    </span>
                </div>
                
                {showDetails && !isSmall && (
                    <div className="flex flex-col items-end text-xs opacity-70 gap-1 font-medium">
                        <div className="flex items-center gap-1.5">
                            <span className="w-8 text-right">Feels</span>
                            <span className="font-bold">{Math.round(current.apparent_temperature)}°</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <WindIcon className="w-3 h-3" />
                            <span className="font-bold">{current.wind_speed_10m} km/h</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <DropletsIcon className="w-3 h-3" />
                            <span className="font-bold">{current.relative_humidity_2m}%</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Forecast */}
            {showForecast && daily && (
                <div 
                    ref={scrollRef}
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseLeave={handleMouseLeave}
                    onMouseUp={handleMouseUp}
                    onMouseMove={handleMouseMove}
                    className="mt-4 pt-3 border-t border-zinc-500/20 dark:border-zinc-500/20 flex gap-4 overflow-x-auto z-10 [&::-webkit-scrollbar]:hidden pb-1 pointer-events-auto cursor-grab active:cursor-grabbing select-none"
                >
                    {forecastDays.map((dayOffset) => {
                        if (!daily.time[dayOffset]) return null;
                        const date = new Date(daily.time[dayOffset]);
                        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                        const { Icon: DayIcon } = getWeatherDetails(daily.weather_code[dayOffset], true);
                        
                        return (
                            <div key={dayOffset} className="flex flex-col items-center gap-1 shrink-0 snap-start">
                                <span className="text-[10px] font-medium opacity-75">{dayName}</span>
                                <DayIcon className="w-4 h-4 opacity-90" />
                                <div className="text-xs font-semibold flex gap-1">
                                    <span>{Math.round(daily.temperature_2m_max[dayOffset])}°</span>
                                    <span className="opacity-60">{Math.round(daily.temperature_2m_min[dayOffset])}°</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
