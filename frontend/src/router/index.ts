import { createRouter, createWebHistory } from 'vue-router';
import Home from '../views/Home.vue';
import Game from '../views/Game.vue';
import Lobby from '../views/Lobby.vue';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/game',
    name: 'Game',
    component: Game
  }
  ,
  {
    path: '/lobby',
    name: 'Lobby',
    component: Lobby
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
