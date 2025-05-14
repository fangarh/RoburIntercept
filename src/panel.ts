

export const commands = {
  'extension.helloRoburView': async (ctx: Context): Promise<DefinedView> => {
    return {
      get id() {
        return 'helloRoburView';
      },
      get extension() {
        return ctx.extension;
      },
      get settings() {
        return ctx.extension.settings('');
      },
      get onDidBroadcast() {
        return () => ({ dispose() {} });
      },
      weight: 1,
      expanded: true,
      get label() {
        return 'Hello Robur';
      },
      get description() {
        return 'A simple bottom view';
      },
      render(container: HTMLElement) {
        container.innerText = 'Hello robur';
        container.style.padding = '8px';
        container.style.fontSize = '16px';
        container.style.fontFamily = 'sans-serif';
      }
    };
  }
};