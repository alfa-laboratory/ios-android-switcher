import React, { useCallback, useState, useEffect } from 'react';
import axios from 'axios';
import Button from './Button';

import '../styles/app.css';
import { RestoreProp, restoreProps, RestorerOptions } from '../../plugin/Restorer';

const REPO_URL = 'https://raw.githubusercontent.com/alfa-laboratory/figma-mobile-components/master';
const COMPONENTS_URL = `${REPO_URL}/data/components.json`;
const PAIRS_URL = 'https://digital.alfabank.ru/figma-pairs/pairs';

const postMessage = (payload: { type: MessageType; [key: string]: any }) => {
  parent.postMessage({ pluginMessage: payload }, '*');
};

const App = ({}) => {
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  const [data, setData] = useState(null);
  const [results, setResults] = useState([]);
  const [restoreOptions, setRestoreOptions] = useState<RestorerOptions>({
    props: ['fills', 'characters'],
  });

  useEffect(() => {
    axios.all([axios.get(PAIRS_URL), axios.get(COMPONENTS_URL)]).then(
      axios.spread((pairsResponse, componentsResponse) => {
        const components = {};

        const componentsMap = componentsResponse.data.reduce((acc, c) => {
          const name = `${c.platform}|${c.name}`;
          acc[c.key] = name;
          components[name] = c;
          return acc;
        }, {});

        const pairs = pairsResponse.data.reduce((acc, pair) => {
          const [key1, key2] = pair;

          acc[componentsMap[key1]] = componentsMap[key2];
          acc[componentsMap[key2]] = componentsMap[key1];
          return acc;
        }, {});

        setLoaded(true);

        setData({
          pairs,
          components,
        });
      })
    );

    window.onmessage = (event: MessageEvent) => {
      console.log(event.data.pluginMessage);

      const { type, message } = event.data.pluginMessage as { type: MessageType; message: any };

      if (type === 'DONE') {
        setPending(false);
        setResults(message);
      }
    };
  }, []);

  const handleSwitchButtonClick = useCallback(() => {
    setResults([]);
    setPending(true);
    setTimeout(() => {
      postMessage({ type: 'SWITCH', data });
    }, 100);
  }, [data]);

  const handleRestoreButtonClick = () => {
    postMessage({ type: 'RESTORE', options: restoreOptions });
  };

  const handleRestorePropsChange = (prop: RestoreProp, checked: boolean) => {
    setRestoreOptions({
      ...restoreOptions,
      props: checked ? restoreOptions.props.filter((p) => p !== prop) : [...restoreOptions.props, prop],
    });
  };

  const handleFocus = (nodeId: ComponentNode) => {
    postMessage({ type: 'FOCUS', nodeId });
  };

  const renderResults = useCallback(() => {
    const fails = results.filter((r) => r.result !== 'SUCCESS');
    const success = results.filter((r) => r.result === 'SUCCESS');

    return (
      <div className="results">
        <span className="section-title">Ошибки - {fails.length}</span>
        {fails.map((item, i) => (
          <a key={i} onClick={() => handleFocus(item.id)}>
            {item.name} — {item.result}
          </a>
        ))}

        <span className="section-title">Заменено - {success.length}</span>
        {success.map((item, i) => (
          <a key={i} onClick={() => handleFocus(item.id)}>
            {item.name}
          </a>
        ))}
      </div>
    );
  }, [results]);
  return (
    <div className="plugin">
      <h1>UI/UX от бога 🙈</h1>

      <p>Выдели фрейм, который хочешь поменять</p>

      <Button onClick={handleSwitchButtonClick} disabled={!loaded || pending}>
        Заменить на парный
      </Button>

      <hr />

      <p>
        Выдели сначала новый КОМПОНЕНТ (не фрейм), потом нажми command+shift и выдели старый компонент. Если звезды
        сойдутся, то изменения применятся на замененный компонент.
      </p>

      <div className="restore-props">
        {restoreProps.map((prop) => {
          const checked = restoreOptions.props.includes(prop);
          return (
            <label key={prop}>
              <input type="checkbox" checked={checked} onChange={() => handleRestorePropsChange(prop, checked)} />
              {prop}
            </label>
          );
        })}
      </div>

      <Button onClick={handleRestoreButtonClick} disabled={!loaded || pending}>
        Попробовать накатить изменения
      </Button>

      <p>
        Если что-то не работает, открой консоль (Plugins {'->'} Development {'->'} Open Console), запусти плагин еще раз
        и скинь скриншот @reme3d2y
      </p>

      {results.length > 0 && renderResults()}
    </div>
  );
};

export default App;
