import React from 'react';

export default function TodoArea({ widgetId }: { widgetId: string }) {
    return (
        <div className="flex flex-col w-full h-full text-zinc-100 p-4 pointer-events-auto">
            <h3 className="text-sm font-semibold mb-3">Tasks</h3>
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <input type="checkbox" className="rounded-sm bg-zinc-800 border-zinc-700" />
                    <span className="text-xs text-zinc-300">Buy groceries</span>
                </div>
                <div className="flex items-center gap-2">
                    <input type="checkbox" className="rounded-sm bg-zinc-800 border-zinc-700" defaultChecked />
                    <span className="text-xs text-zinc-500 line-through">Call mom</span>
                </div>
                <div className="flex items-center gap-2">
                    <input type="checkbox" className="rounded-sm bg-zinc-800 border-zinc-700" />
                    <span className="text-xs text-zinc-300">Finish project</span>
                </div>
            </div>
        </div>
    );
}
