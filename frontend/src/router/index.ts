import { createRouter, createWebHistory } from 'vue-router';
import Home from '../views/Home.vue';
import Game from '../views/Game.vue';
import Lobby from '../views/Lobby.vue';
import Profile from '../views/Profile.vue';
import GameReview from '../views/GameReview.vue';
import Rules from '../views/Rules.vue';

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
  },
  {
    path: '/profile',
    name: 'Profile',
    component: Profile
  },
  {
    path: '/game-review/:gameId',
    name: 'GameReview',
    component: GameReview
  },
  {
    path: '/rules',
    name: 'Rules',
    component: Rules
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
