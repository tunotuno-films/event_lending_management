    import { useState, useEffect } from 'react';
    import { supabase } from '../lib/supabase';

    function DailyRegistration() {
    const [selectedEvent, setSelectedEvent] = useState<{ event_id: string; name: string } | null>(null);

    useEffect(() => {
        const storedEventId = localStorage.getItem('selectedEventId');
        if (storedEventId) {
        supabase
            .from('events')
            .select('event_id, name')
            .eq('event_id', storedEventId)
            .maybeSingle()
            .then(({ data }) => {
            if (data) {
                setSelectedEvent({ event_id: data.event_id, name: data.name });
            }
            });
        }
    }, []);

    useEffect(() => {
        const handleSelectedEventChanged = () => {
        const storedEventId = localStorage.getItem('selectedEventId');
        if (storedEventId) {
            supabase
            .from('events')
            .select('event_id, name')
            .eq('event_id', storedEventId)
            .maybeSingle()
            .then(({ data, error }) => {
                if (error) {
                console.error('イベント情報取得エラー:', error);
                setSelectedEvent(null);
                } else if (data) {
                setSelectedEvent({ event_id: data.event_id, name: data.name });
                } else {
                setSelectedEvent(null);
                }
            });
        } else {
            setSelectedEvent(null);
        }
        };
        window.addEventListener('selectedEventChanged', handleSelectedEventChanged);
        return () => window.removeEventListener('selectedEventChanged', handleSelectedEventChanged);
    }, []);

    return (
        <div>
        <h1>当日物品登録</h1>
        {selectedEvent ? (
            <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-md text-sm">
            {selectedEvent.event_id} - {selectedEvent.name} 選択中
            </div>
        ) : (
            <div className="text-gray-500">イベントが選択されていません</div>
        )}
        </div>
    );
    }

    export default DailyRegistration;