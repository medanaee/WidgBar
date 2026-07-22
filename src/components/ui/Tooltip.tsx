import { useParams } from 'react-router-dom';

export default function Tooltip() {
    const { text } = useParams<{ text: string }>();

    return (
        <div className="w-screen h-screen flex items-center justify-center p-1 bg-transparent overflow-hidden select-none font-sans">
            <div className="bg-transparent text-zinc-900 dark:text-zinc-100 text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                {text ? decodeURIComponent(text) : ""}
            </div>
        </div>
    );
}
