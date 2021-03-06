/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// tslint:disable:no-new-decorators
import '../elements/generated_text_vis';

import {customElement, html} from 'lit-element';
import {computed, observable} from 'mobx';

import {LitModule} from '../core/lit_module';
import {DiffMode, GeneratedTextCandidate} from '../elements/generated_text_vis';
import {IndexedInput, Input, LitName, ModelInfoMap, Spec} from '../lib/types';
import {doesOutputSpecContain, findSpecKeys, isLitSubtype} from '../lib/utils';

import {styles} from './generated_text_module.css';
import {styles as sharedStyles} from './shared_styles.css';

interface GeneratedTextResult {
  [key: string]: GeneratedTextCandidate[];
}

/**
 * A LIT module that renders generated text.
 */
@customElement('generated-text-module')
export class GeneratedTextModule extends LitModule {
  static title = 'Generated Text';
  static duplicateForExampleComparison = true;
  static duplicateAsRow = false;
  static template = (model = '', selectionServiceIndex = 0) => {
    return html`
      <generated-text-module model=${model}
        selectionServiceIndex=${selectionServiceIndex}>
      </generated-text-module>`;
  };


  static supportedTypes: LitName[] =
      ['GeneratedText', 'GeneratedTextCandidates'];

  static get styles() {
    return [sharedStyles, styles];
  }

  @observable private inputData: Input|null = null;
  @observable private generatedText: GeneratedTextResult = {};
  @observable private diffMode: DiffMode = DiffMode.NONE;

  @computed
  get referenceFields(): Map<string, string> {
    const dataSpec = this.appState.currentDatasetSpec;
    const outputSpec = this.appState.getModelSpec(this.model).output;
    const refMap = new Map<string, string>();
    const textKeys =
        findSpecKeys(outputSpec, GeneratedTextModule.supportedTypes);
    for (const textKey of textKeys) {
      const parent = outputSpec[textKey].parent;
      if (parent && dataSpec[parent]) {
        refMap.set(textKey, parent);
      }
    }
    return refMap;
  }


  firstUpdated() {
    this.reactImmediately(
        () => this.selectionService.primarySelectedInputData, data => {
          this.updateSelection(data);
        });
  }

  private async updateSelection(input: IndexedInput|null) {
    this.inputData = null;
    this.generatedText = {};
    if (input == null) return;

    const dataset = this.appState.currentDataset;
    const promise = this.apiService.getPreds(
        [input], this.model, dataset, GeneratedTextModule.supportedTypes,
        'Generating text');
    const results = await this.loadLatest('generatedText', promise);
    if (results === null) return;

    this.inputData = input.data;
    // Post-process results
    const spec = this.appState.getModelSpec(this.model).output;
    const result = results[0];
    for (const key of Object.keys(result)) {
      if (isLitSubtype(spec[key], 'GeneratedText')) {
        result[key] = [[result[key], null]];
      }
    }
    this.generatedText = result;
  }

  renderControls() {
    if (!this.referenceFields.size) {
      return null;
    }

    const setDiffMode = (e: Event) => {
      this.diffMode = (e.target as HTMLInputElement).value as DiffMode;
    };
    // clang-format off
    return html`
      <div class="diff-selector">
        Highlight diffs:
        ${Object.values(DiffMode).map(val => html`
          <input type="radio" name="diffSelect" value="${val}" id='diff${val}'
           ?checked=${val === this.diffMode} @change=${setDiffMode}>
          <label for='diff${val}'>${val}</label>
        `)}
      </div>
    `;
    // clang-format on
  }

  renderOutputGroup(name: string) {
    const referenceFieldName = this.referenceFields.get(name) ?? undefined;
    const referenceText = this.inputData?.[referenceFieldName!] ?? undefined;
    // clang-format off
    return html`
      <generated-text-vis .fieldName=${name}
                          .candidates=${this.generatedText[name]}
                          .referenceFieldName=${referenceFieldName}
                          .referenceText=${referenceText}
                          .diffMode=${this.diffMode}>
      </generated-text-vis>
    `;
    // clang-format on
  }

  render() {
    // clang-format off
    return html`
      <div class='module-container'>
        <div class='module-toolbar'>
          ${this.renderControls()}
        </div>
        <div class="module-results-area">
          ${Object.keys(this.generatedText).map(
              name => this.renderOutputGroup(name))}
        </div>
      </div>
    `;
    // clang-format on
  }

  static shouldDisplayModule(modelSpecs: ModelInfoMap, datasetSpec: Spec) {
    return doesOutputSpecContain(
        modelSpecs, GeneratedTextModule.supportedTypes);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'generated-text-module': GeneratedTextModule;
  }
}
