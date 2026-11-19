import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { event, startAnalytics } from './lib/analytics';
import { app, startedFrom } from './state.svelte';

mount(App, { target: document.getElementById('app')! });
startAnalytics();
event('App opened', { from: startedFrom, bikes: app.frames.length });
