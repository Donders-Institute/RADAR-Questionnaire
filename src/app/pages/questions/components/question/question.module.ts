import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { IonicModule } from 'ionic-angular'

import { PipesModule } from '../../../../shared/pipes/pipes.module'
import { AudioInputComponent } from './audio-input/audio-input.component'
import { CheckboxInputComponent } from './checkbox-input/checkbox-input.component'
import { InfoScreenComponent } from './info-screen/info-screen.component'
import { QuestionComponent } from './question.component'
import { RadioInputComponent } from './radio-input/radio-input.component'
import { RangeInputComponent } from './range-input/range-input.component'
import { SliderInputComponent } from './slider-input/slider-input.component'
import { TimedTestComponent } from './timed-test/timed-test.component'

const COMPONENTS = [
  QuestionComponent,
  AudioInputComponent,
  CheckboxInputComponent,
  RadioInputComponent,
  RangeInputComponent,
  SliderInputComponent,
  TimedTestComponent,
  InfoScreenComponent
]

@NgModule({
  imports: [
    CommonModule,
    PipesModule,
    FormsModule,
    IonicModule.forRoot(SliderInputComponent)
  ],
  declarations: COMPONENTS,
  exports: COMPONENTS
})
export class QuestionModule {}
