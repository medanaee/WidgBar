import { useState } from 'react';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { Switch } from '../../components/ui/switch';
import { SearchIcon, Loader2Icon, CheckIcon } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

function SettingCard({ children }: { children: any }) {
    return (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/50 dark:bg-zinc-900/10 border border-zinc-500/20 dark:border-zinc-500/20 shadow-sm transition-all hover:bg-white/80 dark:hover:bg-zinc-900/50">
            {children}
        </div>
    );
}

export default function WeatherGeneralSetting({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const updateInstance = useWidgetInstanceStore(state => state.updateInstance);

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const useFahrenheit = config.useFahrenheit ?? false;
    const currentCity = config.cityName || 'London';

    const handleUpdate = (updates: any) => {
        updateInstance(widgetId, { ...config, ...updates });
    };

    const searchCity = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchQuery)}&count=5&language=en&format=json`);
            const data = await res.json();
            if (data.results) {
                setSearchResults(data.results);
            } else {
                setSearchResults([]);
            }
        } catch (error) {
            console.error("Geocoding failed", error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const selectCity = (city: any) => {
        handleUpdate({
            cityName: city.name,
            lat: city.latitude,
            lon: city.longitude,
            country: city.country,
            timezone: city.timezone
        });
        setSearchResults([]);
        setSearchQuery('');
    };

    return (
        <div className="space-y-3 pt-2">
            <div className="p-3.5 rounded-xl bg-white/50 dark:bg-zinc-900/10 border border-zinc-500/20 dark:border-zinc-500/20 shadow-sm space-y-3">
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Location</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Current: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{currentCity}</span>
                    </p>
                </div>
                
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Input 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && searchCity()}
                            placeholder="Search city..."
                            className="h-8 text-xs "
                        />
                    </div>
                    <Button 
                        size="sm" 
                        variant="secondary"
                        className="h-8 px-2.5"
                        onClick={searchCity}
                        disabled={isSearching}
                    >
                        {isSearching ? <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> : <SearchIcon className="w-3.5 h-3.5" />}
                    </Button>
                </div>

                {searchResults.length > 0 && (
                    <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md overflow-hidden shadow-sm mt-2 flex flex-col">
                        {searchResults.map((city, idx) => (
                            <button
                                key={idx}
                                onClick={() => selectCity(city)}
                                className="text-left px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700/50 flex items-center justify-between group transition-colors border-b border-zinc-100 dark:border-zinc-700/50 last:border-0"
                            >
                                <div>
                                    <span className="font-medium text-zinc-800 dark:text-zinc-200">{city.name}</span>
                                    {city.admin1 && <span className="text-zinc-500 ml-1">, {city.admin1}</span>}
                                    {city.country && <span className="text-zinc-400 ml-1">({city.country})</span>}
                                </div>
                                <CheckIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 text-blue-500" />
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Use Fahrenheit</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Display temperature in °F</p>
                </div>
                <Switch 
                    checked={useFahrenheit} 
                    onCheckedChange={(checked) => handleUpdate({ useFahrenheit: checked })} 
                />
            </SettingCard>
        </div>
    );
}
