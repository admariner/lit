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
import difflib from 'difflib';

import {customElement, html, property} from 'lit-element';
import {classMap} from 'lit-html/directives/class-map';
import {computed, observable} from 'mobx';

import {ReactiveElement} from '../lib/elements';
import {styles as sharedStyles} from '../modules/shared_styles.css';

import {styles} from './generated_text_vis.css';

// tslint:disable-next-line:no-any difflib does not support Closure imports
// difflib declare placeholder - DO NOT REMOVE

/**
 * Input data format.
 */
export type GeneratedTextCandidate = [string, number | null];

/**
 * Mode for diffs against reference text.
 */
export enum DiffMode {
  NONE = 'None',
  WORD = 'Word',
  CHAR = 'Character',
}

interface TextDiff {
  inputStrings: string[];
  outputStrings: string[];
  equal: boolean[];
}

/** Generated text display, with optional diffs. */
@customElement('generated-text-vis')
export class GeneratedTextVis extends ReactiveElement {
  /* Data binding */
  @observable @property({type: String}) fieldName: string = '';
  @observable
  @property({type: Array})
  candidates: GeneratedTextCandidate[] = [];
  @observable @property({type: String}) referenceFieldName?: string;
  @observable @property({type: String}) referenceText?: string;
  @observable @property({type: String}) diffMode: DiffMode = DiffMode.NONE;
  @observable @property({type: Number}) selectedIdx = 0;

  static get styles() {
    return [sharedStyles, styles];
  }

  @computed
  get textDiff() {
    if (this.referenceText === undefined) return;
    if (this.candidates[this.selectedIdx] === undefined) return;
    if (this.diffMode === DiffMode.NONE) return;
    // Actually compute diffs
    const outputText = this.candidates[this.selectedIdx][0];
    const byWord = (this.diffMode === DiffMode.WORD);
    return getTextDiff(this.referenceText, outputText, byWord);
  }

  renderDiffString(strings: string[], equal: boolean[]) {
    let displayStrings = strings;

    // Add spaces between strings for the word-wise character diffs.
    if (this.diffMode === DiffMode.WORD) {
      const lastIndex = strings.length - 1;
      displayStrings = strings.map((item, i) => {
        if (i !== lastIndex) {
          return item.concat(' ');
        }
        return item;
      });
    }

    const displaySpans = displayStrings.map((output, i) => {
      const classes = classMap({highlighted: !equal[i]});
      return html`<span class=${classes}>${output}</span>`;
    });
    return displaySpans;
  }

  renderReference() {
    // clang-format off
    return html`
      <tr class='output-row'>
        <th>${this.referenceFieldName}</th>
        <td>
          <div class='token-chip-label'>
            ${this.textDiff ? this.renderDiffString(this.textDiff.inputStrings,
                                                    this.textDiff.equal)
                            : this.referenceText}
          </div>
        </td>
      </tr>
    `;
    // clang-format on
  }

  renderCandidates() {
    const renderedCandidates = this.candidates.map((candidate, i) => {
      const inner = this.textDiff !== undefined && i === this.selectedIdx ?
          this.renderDiffString(
              this.textDiff.outputStrings, this.textDiff.equal) :
          candidate[0];
      const classes = classMap({
        'token-chip-label': true,
        'candidate-selected': this.selectedIdx === i,
      });
      const onClickSelect = () => {
        this.selectedIdx = i;
      };
      return html`<div class=${classes} @click=${onClickSelect}>${inner}</div>`;
    });

    // clang-format off
    return html`
      <tr class='output-row'>
        <th>${this.fieldName}</th>
        <td><div class='candidates'>${renderedCandidates}</div></td>
      </tr>
    `;
    // clang-format on
  }

  render() {
    // clang-format off
    return html`
      <div class='output'>
        <table class='output-table'>
          ${this.referenceFieldName != null ? this.renderReference() : null}
          ${this.renderCandidates()}
        </table>
      </div>
    `;
    // clang-format on
  }
}

/**
 * Uses difflib library to compute character differences between the input
 * strings and returns a TextDiff object, which contains arrays of parsed
 * segments from both strings and an array of booleans indicating whether the
 * corresponding change type is 'equal.'
 */
export function getTextDiff(
    targetText: string, outputText: string, byWord: boolean): TextDiff {
  // Use difflib library to compute opcodes, which contain a group of changes
  // between the two input strings. Each opcode contains the change type and
  // the start/end of the concerned characters/words in each string.
  const targetWords = targetText.split(' ');
  const outputWords = outputText.split(' ');

  const matcher = byWord ?
      new difflib.SequenceMatcher(() => false, targetWords, outputWords) :
      new difflib.SequenceMatcher(() => false, targetText, outputText);
  const opcodes = matcher.getOpcodes();

  // Store an array of the parsed segments from both strings and whether
  // the change type is 'equal.'
  const inputStrings: string[] = [];
  const outputStrings: string[] = [];
  const equal: boolean[] = [];

  for (const opcode of opcodes) {
    const changeType = opcode[0];
    const startA = Number(opcode[1]);
    const endA = Number(opcode[2]);
    const startB = Number(opcode[3]);
    const endB = Number(opcode[4]);

    equal.push((changeType === 'equal'));

    if (byWord) {
      inputStrings.push(targetWords.slice(startA, endA).join(' '));
      outputStrings.push(outputWords.slice(startB, endB).join(' '));
    } else {
      inputStrings.push(targetText.slice(startA, endA));
      outputStrings.push(outputText.slice(startB, endB));
    }
  }

  const textDiff: TextDiff = {inputStrings, outputStrings, equal};
  return textDiff;
}


declare global {
  interface HTMLElementTagNameMap {
    'generated-text-vis': GeneratedTextVis;
  }
}
