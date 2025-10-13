import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { createApplication } from '@angular/platform-browser';
import { createCustomElement } from '@angular/elements';
import { ButtonComponent } from './app/shared/button/button.component';
import { AlertComponent } from './app/shared/alert/alert.component';
import { CardComponent } from './app/shared/card/card.component';
import './app/shared/markdown-renderer/markdown-renderer.element';
import './app/shared/codemirror-editor/codemirror-editor.element';
import './app/shared/echarts-chart/echarts-chart.element';
import './app/shared/simple-table/simple-table.element';

(async () => {
  const appRef = await createApplication(appConfig);
  const injector = appRef.injector;

  // Convert Angular components to Web Components (Custom Elements)
  customElements.define(
    'app-button',
    createCustomElement(ButtonComponent, { injector })
  );
  customElements.define(
    'app-alert',
    createCustomElement(AlertComponent, { injector })
  );
  customElements.define(
    'app-card',
    createCustomElement(CardComponent, { injector })
  );

  bootstrapApplication(AppComponent, appConfig).catch((err) =>
    console.error(err)
  );
})();
