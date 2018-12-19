import 'rxjs/add/operator/map'

import { Injectable } from '@angular/core'

import { Task } from '../../shared/models/task'
import { LocalizationService } from './localization.service'
import { NotificationType, SingleNotification } from '../../shared/models/notification-handler'
import { Assessment } from '../../shared/models/assessment'
import { ProtocolNotification } from '../../shared/models/protocol'
import { SchedulingService } from './scheduling.service'
import { LocKeys } from '../../shared/enums/localisations'

@Injectable()
export class NotificationGeneratorService {
  constructor(
    private localization: LocalizationService,
  ) {
  }

  futureNotifications(tasks: Task[], limit: number): SingleNotification[] {
    const now = new Date().getTime()
    return tasks
      .map(t => t.notifications.filter(n => n.timestamp > now))
      .reduce((arr, n) => arr.concat(n), [])
      .sort(NotificationGeneratorService.compareNotifications)
      .slice(0, limit)
  }

  consoleLogNotifications(tasks: Task[]) {
    const notifications = this.futureNotifications(tasks, 20)
    let rendered = `\nNOTIFICATIONS Total (${notifications.length})\n`
    rendered += notifications
      .map(n => `DATE ${new Date(n.timestamp)} NAME ${n.task.name}`)
      .reduce((a, b) => a + '\n' + b)

    console.log(rendered)
  }

  createNotifications(assessment: Assessment, task: Task): SingleNotification[] {
    let notifications: SingleNotification[] = []
    notifications.push(this.createNotification(
      task,
      task.timestamp,
      NotificationType.NOW,
      assessment.protocol.notification,
    ))
    const reminders = assessment.protocol.reminders

    if (reminders) {
      if (reminders instanceof Array) {
        notifications = notifications.concat(
          reminders.map(r => this.createNotification(
            task,
            SchedulingService.advanceRepeat(task.timestamp, r.offset),
            NotificationType.REMINDER,
            r.notification,
            )
          )
        )
      } else {
        const repetitions = reminders.repeat === undefined ? 1 : reminders.repeat
        let currentTimestamp = task.timestamp
        for (let i = 0; i < repetitions; i++) {
          currentTimestamp = SchedulingService.advanceRepeat(currentTimestamp, reminders)
          notifications.push(this.createNotification(
            task,
            currentTimestamp,
            NotificationType.REMINDER,
            null,
          ))
        }
      }
    }

    return notifications.filter(n => n)
  }

  private createNotification(
      task: Task,
      timestamp: number,
      type: NotificationType,
      protocolNotification?: ProtocolNotification,
  ): SingleNotification | null {
    const current: SingleNotification = {task, timestamp, type}

    // Set default content
    switch (type) {
      case NotificationType.REMINDER:
        current.sound = false
        current.vibrate = true
        current.title = this.localization.translateKey(LocKeys.NOTIFICATION_REMINDER_FORGOTTEN)
        current.text = this.localization.translateKey(LocKeys.NOTIFICATION_REMINDER_FORGOTTEN_DESC)
        break
      case NotificationType.NOW:
        current.sound = true
        current.vibrate = true
        current.title = this.localization.translateKey(LocKeys.NOTIFICATION_REMINDER_NOW)
        current.text = this.localization.translateKey(LocKeys.NOTIFICATION_REMINDER_NOW_DESC_1)
            + ' ' + task.completionWindow + ' '
            + this.localization.translateKey(LocKeys.NOTIFICATION_REMINDER_NOW_DESC_2)
        break
      case NotificationType.MISSED:
        current.sound = false
        current.vibrate = false
        current.title = this.localization.translateKey(LocKeys.NOTIFICATION_REMINDER_FORGOTTEN)
        current.text = this.localization.translateKey(LocKeys.NOTIFICATION_REMINDER_FORGOTTEN_ALERT_DEFAULT_DESC)
        break
      case NotificationType.SOON:
        current.sound = false
        current.vibrate = false
        current.title = this.localization.translateKey(LocKeys.NOTIFICATION_REMINDER_SOON)
        current.text = this.localization.translateKey(LocKeys.NOTIFICATION_REMINDER_SOON_DESC)
        break
      case NotificationType.MISSED_SOON:
        current.sound = false
        current.vibrate = false
        current.title = this.localization.translateKey(LocKeys.NOTIFICATION_REMINDER_SOON)
        current.text = this.localization.translateKey(LocKeys.NOTIFICATION_REMINDER_SOON_DESC)
        break
      default:
        console.log('Unknown notification type ' + type)
        return null
    }
    if (protocolNotification) {
      if (protocolNotification.title) {
        current.title = this.localization.chooseText(protocolNotification.title)
      }
      if (protocolNotification.text) {
        current.text = this.localization.chooseText(protocolNotification.text)
      }

      current.sound = protocolNotification.sound
      current.vibrate = protocolNotification.vibrate
    }
    return current
  }

  static compareNotifications(a: SingleNotification, b: SingleNotification) {
    const diff = a.timestamp - b.timestamp
    if (diff != 0) {
      return diff
    }
    const aName = a.task.name.toUpperCase()
    const bName = b.task.name.toUpperCase()
    if (aName < bName) {
      return -1
    } else if (aName > bName) {
      return 1
    } else {
      return 0
    }
  }
}