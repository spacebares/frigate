import { h } from 'preact';
import { set as setData, get as getData } from 'idb-keyval';
import { DarkModeProvider, useDarkMode, usePersistence, UserViewProvider, useUserView } from '..';
import { UserViewTypes } from '../../context/UserViewTypes'
import { fireEvent, render, screen } from 'testing-library';
import { useCallback } from 'preact/hooks';
import * as WS from '../../api/ws';

function DarkModeChecker() {
  const { currentMode } = useDarkMode();
  return <div data-testid={currentMode}>{currentMode}</div>;
}

describe('DarkMode', () => {
  beforeEach(() => {
    vi.spyOn(WS, 'WsProvider').mockImplementation(({ children }) => children);
  });

  test('uses media by default', async () => {
    render(
      <DarkModeProvider>
        <DarkModeChecker />
      </DarkModeProvider>
    );
    const el = await screen.findByTestId('media');
    expect(el).toBeInTheDocument();
  });

  test('uses the mode stored in idb - dark', async () => {
    setData('darkmode', 'dark');
    render(
      <DarkModeProvider>
        <DarkModeChecker />
      </DarkModeProvider>
    );
    const el = await screen.findByTestId('dark');
    expect(el).toBeInTheDocument();
    expect(document.body.classList.contains('dark')).toBe(true);
  });

  test('uses the mode stored in idb - light', async () => {
    setData('darkmode', 'light');
    render(
      <DarkModeProvider>
        <DarkModeChecker />
      </DarkModeProvider>
    );
    const el = await screen.findByTestId('light');
    expect(el).toBeInTheDocument();
    expect(document.body.classList.contains('dark')).toBe(false);
  });

  test('allows updating the mode', async () => {
    setData('darkmode', 'dark');

    function Updater() {
      const { setDarkMode } = useDarkMode();
      const handleClick = useCallback(() => {
        setDarkMode('light');
      }, [setDarkMode]);
      return <div onClick={handleClick}>click me</div>;
    }

    render(
      <DarkModeProvider>
        <DarkModeChecker />
        <Updater />
      </DarkModeProvider>
    );

    const dark = await screen.findByTestId('dark');
    expect(dark).toBeInTheDocument();
    expect(document.body.classList.contains('dark')).toBe(true);

    const button = await screen.findByText('click me');
    fireEvent.click(button);

    const light = await screen.findByTestId('light');
    expect(light).toBeInTheDocument();
    expect(document.body.classList.contains('dark')).toBe(false);
  });

  test('when using media, matches on preference', async () => {
    setData('darkmode', 'media');
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
      if (query === '(prefers-color-scheme: dark)') {
        return { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
      }

      throw new Error(`Unexpected query to matchMedia: ${query}`);
    });
    render(
      <DarkModeProvider>
        <DarkModeChecker />
      </DarkModeProvider>
    );

    const el = await screen.findByTestId('dark');
    expect(el).toBeInTheDocument();
    expect(document.body.classList.contains('dark')).toBe(true);
  });
});

describe('usePersistence', () => {

  test('returns a defaultValue initially', async () => {

    function Component() {
      const [value, , loaded] = usePersistence('tacos', 'my-default');
      return (
        <div>
          <div data-testid="loaded">{loaded ? 'loaded' : 'not loaded'}</div>
          <div data-testid="value">{value}</div>
        </div>
      );
    }

    render(<Component />);

    expect(screen.getByTestId('loaded')).toMatchInlineSnapshot(`
      <div
        data-testid="loaded"
      >
        not loaded
      </div>
    `);
    expect(screen.getByTestId('value')).toMatchInlineSnapshot(`
      <div
        data-testid="value"
      >
        my-default
      </div>
    `);
  });

  test('updates with the previously-persisted value', async () => {
    setData('tacos', 'are delicious');

    function Component() {
      const [value, , loaded] = usePersistence('tacos', 'my-default');
      return (
        <div>
          <div data-testid="loaded">{loaded ? 'loaded' : 'not loaded'}</div>
          <div data-testid="value">{value}</div>
        </div>
      );
    }

    render(<Component />);

    await screen.findByText('loaded');

    expect(screen.getByTestId('loaded')).toMatchInlineSnapshot(`
      <div
        data-testid="loaded"
      >
        loaded
      </div>
    `);
    expect(screen.getByTestId('value')).toMatchInlineSnapshot(`
      <div
        data-testid="value"
      >
        are delicious
      </div>
    `);
  });

  test('can be updated manually', async () => {
    setData('darkmode', 'are delicious');

    function Component() {
      const [value, setValue] = usePersistence('tacos', 'my-default');
      const handleClick = useCallback(() => {
        setValue('super delicious');
      }, [setValue]);
      return (
        <div>
          <div onClick={handleClick}>click me</div>
          <div data-testid="value">{value}</div>
        </div>
      );
    }

    render(<Component />);

    const button = await screen.findByText('click me');
    fireEvent.click(button);

    expect(screen.getByTestId('value')).toMatchInlineSnapshot(`
      <div
        data-testid="value"
      >
        super delicious
      </div>
    `);
  });
});

function UserViewChecker() {
  const { currentUserView } = useUserView();
  return <div data-testid={currentUserView}>{currentUserView}</div>;
}

describe('ViewMode', () => {
  beforeEach(() => {
    vi.spyOn(WS, 'WsProvider').mockImplementation(({ children }) => children);
  });

  test('uses admin mode (max of enum) due to invalid config', async () => {
    setData('view-mode', null);

    render(
      <UserViewProvider>
        <UserViewChecker />
      </UserViewProvider>
    );

    const maxViewMode = (Object.keys(UserViewTypes).filter(isNaN).length-1);
    const el = await screen.findByTestId(maxViewMode);
    expect(el).toBeInTheDocument();
  });

  Object.keys(UserViewTypes).filter((v) => !isNaN(Number(v))).map(key => 
    test(`uses a viewmode option that is stored in idb - ${UserViewTypes[key]}`, async () => {
      setData('view-mode', key);

      render(
        <UserViewProvider>
          <UserViewChecker />
        </UserViewProvider>
      );

      const el = await screen.findByTestId(key);
      expect(el).toBeInTheDocument();
    })
  )

  test('update viewmode live, using setUserView from context and verify idb save', async () => {
    setData('view-mode', null);

    function Updater() {
      const { setUserView } = useUserView();
      const handleClick = useCallback((value) => {
        setUserView(value.button.toString());
      }, [setUserView]);
      return <div onClick={handleClick}>click me</div>;
    }

    render(
      <UserViewProvider>
        <UserViewChecker />
        <Updater />
      </UserViewProvider>
    );

    const button = await screen.findByText('click me');
    const maxViewMode = (Object.keys(UserViewTypes).filter(isNaN).length-1);

    fireEvent.click(button, {button: '0'});
    const minmode = await screen.findByTestId('0');
    expect(minmode).toBeInTheDocument();

    const minmodeidb = await getData('view-mode');
    expect(minmodeidb).toEqual('0')

    fireEvent.click(button, {button: maxViewMode});
    const maxmode = await screen.findByTestId(maxViewMode);
    expect(maxmode).toBeInTheDocument();

    const maxmodeidb = await getData('view-mode');
    expect(maxmodeidb).toEqual(maxViewMode.toString());
  });
});