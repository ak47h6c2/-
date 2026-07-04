import designSystem from "../../../design-system/careerpilot-apac.design-system.json";

type ColorToken = {
  name: string;
  css: string;
  value: string;
  figmaName: string;
};

type ScaleToken = {
  name: string;
  css: string;
  value: string;
  figmaName: string;
};

type ComponentSpec = {
  name: string;
  figmaComponent: string;
  classes: string[];
  states: string[];
  usage: string;
};

export default function DesignSystemPage() {
  const colors = designSystem.tokens.colors as ColorToken[];
  const spacing = designSystem.tokens.spacing as ScaleToken[];
  const radii = designSystem.tokens.radii as ScaleToken[];
  const components = designSystem.components as ComponentSpec[];

  return (
    <main className="design-system-page">
      <section className="design-system-hero">
        <div>
          <span className="section-kicker">CareerPilot APAC</span>
          <h1>设计系统组件库</h1>
          <p>代码侧 Figma 交付源。这里展示 token、组件命名、状态和可复用 UI 形态，用于和最终 Figma 组件库对齐。</p>
        </div>
        <div className="design-system-version">
          <span>版本</span>
          <strong>{designSystem.version}</strong>
          <em>{designSystem.locale}</em>
        </div>
      </section>

      <section className="design-system-grid">
        <article className="panel">
          <div className="panel-title compact">
            <h2>颜色 Tokens</h2>
            <span className="soft-pill success">{colors.length} 项</span>
          </div>
          <div className="token-grid">
            {colors.map((token) => (
              <div className="token-card" key={token.css}>
                <span className="token-swatch" style={{ background: token.value }} />
                <strong>{token.figmaName}</strong>
                <span>{token.css}</span>
                <code>{token.value}</code>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-title compact">
            <h2>间距与圆角</h2>
            <span className="soft-pill neutral">Figma 变量</span>
          </div>
          <div className="scale-list">
            {spacing.map((token) => (
              <div className="scale-row" key={token.css}>
                <strong>{token.figmaName}</strong>
                <span style={{ width: token.value }} />
                <code>{token.value}</code>
              </div>
            ))}
          </div>
          <div className="radius-grid">
            {radii.map((token) => (
              <div className="radius-tile" key={token.css} style={{ borderRadius: token.value }}>
                <strong>{token.figmaName}</strong>
                <span>{token.value}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-title compact">
          <h2>核心组件</h2>
          <span className="soft-pill success">{components.length} 组</span>
        </div>
        <div className="component-spec-grid">
          {components.map((component) => (
            <article className="component-spec-card" key={component.name}>
              <div>
                <span>{component.name}</span>
                <strong>{component.figmaComponent}</strong>
                <p>{component.usage}</p>
              </div>
              <div className="chip-list">
                {component.states.map((state) => (
                  <span key={state}>{state}</span>
                ))}
              </div>
              <code>{component.classes.map((className) => `.${className}`).join("  ")}</code>
            </article>
          ))}
        </div>
      </section>

      <section className="design-system-grid">
        <article className="panel">
          <div className="panel-title compact">
            <h2>按钮与状态</h2>
            <span className="soft-pill warning">不自动提交</span>
          </div>
          <div className="button-preview-stack">
            <button className="fill-button compact-button" type="button">
              主操作按钮
            </button>
            <button className="secondary-button inline strong" type="button">
              强调次操作
            </button>
            <button className="secondary-button inline" type="button">
              次操作按钮
            </button>
            <button className="secondary-button inline" disabled type="button">
              禁用状态
            </button>
          </div>
          <div className="chip-list preview-chips">
            <span>中性</span>
            <span>成功</span>
            <span>提醒</span>
            <span>危险</span>
          </div>
        </article>

        <article className="panel">
          <div className="panel-title compact">
            <h2>表单字段</h2>
            <span className="soft-pill success">安全优先</span>
          </div>
          <form className="inline-form">
            <label>
              候选人姓名
              <input defaultValue="张同学" />
            </label>
            <label>
              邮箱
              <input defaultValue="your.email@example.com" />
            </label>
            <label>
              需要人工确认
              <select defaultValue="review">
                <option value="safe">安全可填</option>
                <option value="review">需要确认</option>
                <option value="sensitive">敏感勿填</option>
              </select>
            </label>
          </form>
        </article>
      </section>

      <section className="panel">
        <div className="panel-title compact">
          <h2>Figma 交付门禁</h2>
          <span className="soft-pill neutral">质量门禁</span>
        </div>
        <div className="quality-gate-list">
          {designSystem.qualityGates.map((gate) => (
            <div className="readiness-item done" key={gate}>
              <span>通过</span>
              <strong>{gate}</strong>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
