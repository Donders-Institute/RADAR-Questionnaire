import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'

import { Item } from '../../../../../shared/models/question'

let uniqueID = 0

@Component({
  selector: 'range-input',
  templateUrl: 'range-input.component.html'
})
export class RangeInputComponent implements OnInit {
  @Output()
  valueChange: EventEmitter<number> = new EventEmitter<number>()

  @Input()
  min = 1
  @Input()
  max = 10
  @Input()
  labelLeft = ''
  @Input()
  labelRight = ''
  @Input()
  currentlyShown

  value: number = null
  uniqueID: number = uniqueID++
  name = `range-input-${this.uniqueID}`
  items: Item[] = Array()

  ngOnInit() {
    for (let i = this.min; i <= this.max; i++) {
      this.items.push({
        id: `range-${this.uniqueID}-${i}`,
        value: i
      })
    }
  }

  onInputChange(event) {
    this.valueChange.emit(+event.target.value)
  }
}
