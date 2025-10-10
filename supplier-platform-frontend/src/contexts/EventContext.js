import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const EventContext = createContext();

// 辅助函数：将 snake_case 转换为 camelCase
const toCamel = (s) => s.replace(/([-_][a-z])/ig, ($1) => $1.toUpperCase().replace('_', ''));
const convertKeysToCamelCase = (obj) => {
    if (Array.isArray(obj)) return obj.map(v => convertKeysToCamelCase(v));
    if (obj !== null && obj.constructor === Object) {
        return Object.keys(obj).reduce((result, key) => {
            result[toCamel(key)] = convertKeysToCamelCase(obj[key]);
            return result;
        }, {});
    }
    return obj;
};

export const EventProvider = ({ children }) => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchEvents = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('annual_plan_events')
                .select(`*, supplier:suppliers(*), auditor:users(*)`);
            
            if (error) throw error;
            setEvents(convertKeysToCamelCase(data));
        } catch (error) {
            console.error("获取年度计划数据失败:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
        const channel = supabase.channel('public:annual_plan_events')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'annual_plan_events' }, fetchEvents)
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const addEvent = async (newEvent) => {
        const { error } = await supabase.from('annual_plan_events').insert([newEvent]);
        if (error) throw error;
    };

    const updateEvent = async (eventId, updates) => {
        const { error } = await supabase.from('annual_plan_events').update(updates).eq('id', eventId);
        if (error) throw error;
    };

    const deleteEvent = async (eventId) => {
        const { error } = await supabase.from('annual_plan_events').delete().eq('id', eventId);
        if (error) throw error;
    };

    const value = { events, loading, addEvent, updateEvent, deleteEvent };

    return (
        <EventContext.Provider value={value}>
            {children}
        </EventContext.Provider>
    );
};

export const useEvents = () => {
    return useContext(EventContext);
};