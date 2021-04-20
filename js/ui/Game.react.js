// @flow

const React = require('react');
const Button = require('./Components/Button.react');
const Canvas = require('./Canvas.react');
const Checkbox = require('./Components/Checkbox.react');
const RadioPicker = require('./Components/RadioPicker.react');
const TopBar = require('./TopBar.react');
const BottomBar = require('./BottomBar.react');
const {config} = require('../config');
const {initMouseControlsSystem} = require('../systems/mouseControlsSystem');
const {initGameOverSystem} = require('../systems/gameOverSystem');
const {initSpriteSheetSystem} = require('../systems/spriteSheetSystem');
const {initPheromoneWorkerSystem} = require('../systems/pheromoneWorkerSystem');
const {
  initKeyboardControlsSystem
} = require('../systems/keyboardControlsSystem');
const ExperimentalSidebar = require('./ExperimentalSidebar.react');
const {handleCollect, handlePlace} = require('../thunks/mouseInteractions');
const {useEffect, useState, useMemo, Component, memo} = React;
const {add, subtract} = require('../utils/vectors');
const {lookupInGrid} = require('../utils/gridHelpers');
const {clamp, isMobile} = require('../utils/helpers');
const {getControlledEntityInteraction} = require('../selectors/misc');
const {
  isActionTypeQueued, makeAction, isDoingAction,
} = require('../simulation/actionQueue');
const {render} = require('../render/render');

import type {Action, State} from '../types';

type Props = {
  dispatch: (action: Action) => Action,
  store:  Object,
  isInLevelEditor: boolean,
  topBar: mixed,
  controlButtons: mixed,
  gameID: mixed,
  tickInterval: mixed,
};

function Game(props: Props): React.Node {
  const {dispatch, store, isInLevelEditor, gameID, tickInterval} = props;
  const state = store.getState();

  // init systems
  useEffect(() => {
    // trying to prevent pinch zoom
    document.addEventListener('touchmove', function (ev) {
      if (ev.scale !== 1) { ev.preventDefault(); }
    }, {passive: false});
    document.addEventListener('gesturestart', function (ev) {
      ev.preventDefault();
    }, {passive: false});
  }, []);
  useEffect(() => {
    initKeyboardControlsSystem(store);
    // initSpriteSheetSystem(store);
    initGameOverSystem(store);
    initPheromoneWorkerSystem(store);
    // initUpgradeSystem(store);
    registerHotkeys(dispatch);
  }, [gameID]);

  useEffect(() => {
    if (state.game.mouseMode != 'NONE') {
      initMouseControlsSystem(store, configureMouseHandlers(state.game));
    }
  }, [state.game.mouseMode]);


  // ---------------------------------------------
  // memoizing UI stuff here
  // ---------------------------------------------
  const {game} = state;

  const elem = document.getElementById('background');
  const dims = useMemo(() => {
    const dims = {width: window.innerWidth, height: window.innerHeight};
    if (isInLevelEditor && elem != null) {
      const slider = document.getElementById('sliderBar');
      const editor = document.getElementById('levelEditor');
      let sliderWidth = slider != null ? slider.getBoundingClientRect().width : 0;
      let editorWidth = editor != null ? editor.getBoundingClientRect().width : 0;
      dims.width = dims.width - sliderWidth - editorWidth;
    }
    return dims;
  }, [window.innerWidth, window.innerHeight, elem != null]);

  return (
    <div
      className="background" id="background"
      style={{
        position: 'relative',
        display: 'inline-block',
      }}
    >
      {
        state.screen == 'EDITOR'
          ? <ExperimentalSidebar state={state} dispatch={dispatch} />
          : null
      }
      <Canvas
        dispatch={dispatch}
        tickInterval={tickInterval}
        innerWidth={dims.width}
        innerHeight={dims.height}
        isExperimental={state.screen == 'EDITOR'}
        focusedEntity={game.focusedEntity}
        levelName={state.campaign.level}
      />
      <Ticker ticker={game.ticker} />
      <MiniTicker miniTicker={game.miniTicker} />
      <TopBar dispatch={dispatch}
        isExperimental={props.isInLevelEditor}
        tickInterval={state.game.tickInterval}
        modal={state.modal}
        canvasWidth={dims.width}
        isMuted={state.isMuted}
        steps={state.game.actionIndex}
        maxSteps={state.game.maxSteps}
        isTimeReversed={state.game.isTimeReversed}
      />
      <BottomBar dispatch={dispatch}
        game={game}
        mousePos={game.mouse.curPos}
      />
    </div>
  );

}

function registerHotkeys(dispatch) {
  dispatch({
    type: 'SET_HOTKEY', press: 'onKeyDown',
    key: 'space',
    fn: (s) => {
      const game = store.getState().game;
      const playerChar = game.controlledEntity;
      if (!playerChar) return;
      if (game.isTimeReversed) return;
      if (playerChar.actions.length > 0) return;

      console.log("reversing time");
      dispatch({type: 'REVERSE_TIME'});
    },
  });
  dispatch({
    type: 'SET_HOTKEY', press: 'onKeyDown',
    key: 'up',
    fn: (s) => {
      const state = s.getState();
      const game = state.game;
      if (!game.tickInterval && state.screen == 'EDITOR') {
        let moveAmount = Math.round(Math.max(1, game.gridHeight / 30));
        dispatch({
          type: 'SET_VIEW_POS', viewPos: add(game.viewPos, {x: 0, y: moveAmount}),
        });
        render(game);
      }
    }
  });
  dispatch({
    type: 'SET_HOTKEY', press: 'onKeyDown',
    key: 'down',
    fn: (s) => {
      const state = s.getState();
      const game = state.game;
      if (!game.tickInterval && state.screen == 'EDITOR') {
        let moveAmount = Math.round(Math.max(1, game.gridHeight / 30));
        dispatch({
          type: 'SET_VIEW_POS', viewPos: add(game.viewPos, {x: 0, y: -1 * moveAmount}),
        });
        render(game);
      }
    }
  });
  dispatch({
    type: 'SET_HOTKEY', press: 'onKeyDown',
    key: 'left',
    fn: (s) => {
      const state = s.getState();
      const game = state.game;
      if (!game.tickInterval && state.screen == 'EDITOR') {
        let moveAmount = Math.round(Math.max(1, game.gridWidth / 30));
        dispatch({
          type: 'SET_VIEW_POS', viewPos: add(game.viewPos, {x: -1 * moveAmount, y: 0}),
        });
        render(game);
      }
    }
  });
  dispatch({
    type: 'SET_HOTKEY', press: 'onKeyDown',
    key: 'right',
    fn: (s) => {
      const state = s.getState();
      const game = state.game;
      if (!game.tickInterval && state.screen == 'EDITOR') {
        let moveAmount = Math.round(Math.max(1, game.gridWidth / 30));
        dispatch({
          type: 'SET_VIEW_POS', viewPos: add(game.viewPos, {x: moveAmount, y: 0}),
        });
        render(game);
      }
    }
  });
}

function configureMouseHandlers(game) {
  const handlers = {
    scroll: (state, dispatch, zoom) => {
      if (state.screen == 'EDITOR') {
        dispatch({type: 'INCREMENT_ZOOM', zoom});
      }
    },
  }
  return handlers;
}

function Ticker(props) {
  const {ticker} = props;
  if (ticker == null) return null;
  const shouldUseIndex = ticker.time < 60 || ticker.max - ticker.time < 60;
  let index = ticker.time / 60;
  if (ticker.max - ticker.time < 60) {
    index = (ticker.max - ticker.time) / 60;
  }

  return (
    <h2
      style={{
        position: 'absolute',
        top: 100,
        left: 120,
        opacity: shouldUseIndex ? index : 1,
        pointerEvents: 'none',
        textShadow: '-1px -1px 0 #FFF, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff',
      }}
    >
      {ticker.message}
    </h2>
  );
}

function MiniTicker(props) {
  const {miniTicker} = props;
  if (miniTicker == null) return null;

  const shouldUseIndex = miniTicker.time < 60 || miniTicker.max - miniTicker.time < 60;
  let index = miniTicker.time / 60;
  if (miniTicker.max - miniTicker.time < 60) {
    index = (miniTicker.max - miniTicker.time) / 60;
  }

  return (
    <h2
      style={{
        padding: 0,
        margin: 0,
        position: 'absolute',
        top: window.innerHeight - 200,
        left: window.innerWidth - 420,
        opacity: shouldUseIndex ? index : 1,
        pointerEvents: 'none',
        color: 'red',
        textShadow: '-1px -1px 0 #FFF, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff',
      }}
    >
      {miniTicker.message}
    </h2>
  );
}

module.exports = Game;
