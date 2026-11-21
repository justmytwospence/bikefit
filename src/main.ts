import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { event, reportError, startAnalytics } from './lib/analytics';
import { showCrash, watchCrashes } from './lib/crash';
import { app, startedFrom } from './state.svelte';

watchCrashes();
try {
  mount(App, { target: document.getElementById('app')! });
} catch (e) {
  showCrash();
  reportError('mount', e);
}
startAnalytics();
event('App opened', { from: startedFrom, bikes: app.frames.length });
