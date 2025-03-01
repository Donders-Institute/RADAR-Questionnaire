import { animate, state, style, transition, trigger } from '@angular/animations'
import { Component, OnDestroy } from '@angular/core'
import {
  AlertController,
  NavController,
  NavParams,
  Platform
} from 'ionic-angular'
import { Subscription } from 'rxjs'

import { FirebaseAnalyticsService } from '../../../core/services/firebaseAnalytics.service'
import { KafkaService } from '../../../core/services/kafka.service'
import { StorageService } from '../../../core/services/storage.service'
import { LocKeys } from '../../../shared/enums/localisations'
import { StorageKeys } from '../../../shared/enums/storage'
import { Task, TasksProgress } from '../../../shared/models/task'
import { TranslatePipe } from '../../../shared/pipes/translate/translate'
import { checkTaskIsNow } from '../../../shared/utilities/check-task-is-now'
import { ClinicalTasksPageComponent } from '../../clinical-tasks/containers/clinical-tasks-page.component'
import { QuestionsPageComponent } from '../../questions/containers/questions-page.component'
import { SettingsPageComponent } from '../../settings/containers/settings-page.component'
import { SplashPageComponent } from '../../splash/containers/splash-page.component'
import { StartPageComponent } from '../../start/containers/start-page.component'
import { TasksService } from '../services/tasks.service'

@Component({
  selector: 'page-home',
  templateUrl: 'home-page.component.html',
  animations: [
    trigger('displayCalendar', [
      state('true', style({ transform: 'translateY(0)', opacity: 1 })),
      state('false', style({ transform: 'translateY(100%)', opacity: 0 })),
      transition('*=>*', animate('350ms 50ms ease'))
    ]),
    trigger('moveProgress', [
      state('true', style({ transform: 'translateY(-100%)', display: 'none' })),
      state('false', style({ transform: 'translateY(0)' })),
      transition('true=>false', animate('400ms ease'))
    ])
  ]
})
export class HomePageComponent implements OnDestroy {
  sortedTasks: Promise<Map<any, any>>
  tasks: Promise<Task[]>
  tasksDate: Date
  nextTask: Task
  showCalendar = false
  showCompleted = false
  tasksProgress: Promise<TasksProgress>
  startingQuestionnaire = false
  hasClinicalTasks = false
  taskIsNow = false
  checkTaskInterval
  resumeListener: Subscription = new Subscription()

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    public alertCtrl: AlertController,
    private tasksService: TasksService,
    private translate: TranslatePipe,
    public storage: StorageService,
    private platform: Platform,
    private kafka: KafkaService,
    private firebaseAnalytics: FirebaseAnalyticsService
  ) {
    this.resumeListener = this.platform.resume.subscribe(e => {
      this.kafka.sendAllAnswersInCache()
      this.checkForNewDate()
      this.firebaseAnalytics.logEvent('resumed', {})
    })
  }

  ngOnDestroy() {
    this.resumeListener.unsubscribe()
  }

  ionViewWillEnter() {
    this.startingQuestionnaire = false
  }

  ionViewDidLoad() {
    this.sortedTasks = this.tasksService.getSortedTasksOfToday()
    this.tasks = this.tasksService.getTasksOfToday()
    this.tasksProgress = this.tasksService.getTaskProgress()
    this.tasks.then(
      tasks =>
        (this.checkTaskInterval = setInterval(() => {
          this.checkForNextTask(tasks)
        }, 1000))
    )
    this.tasksDate = new Date()
    this.evalHasClinicalTasks()
    this.firebaseAnalytics.setCurrentScreen('home-page')
  }

  checkForNewDate() {
    if (new Date().getDate() !== this.tasksDate.getDate()) {
      this.tasksDate = new Date()
      this.navCtrl.setRoot(SplashPageComponent)
    }
  }

  checkForNextTask(tasks) {
    const task = this.tasksService.getNextTask(tasks)
    if (task) {
      this.nextTask = task
      this.taskIsNow = checkTaskIsNow(this.nextTask.timestamp)
    } else {
      this.taskIsNow = false
      this.nextTask = null
      this.showCompleted = this.tasksService.areAllTasksComplete(tasks)
      if (this.showCompleted) {
        clearInterval(this.checkTaskInterval)
        this.showCalendar = false
      }
    }
  }

  evalHasClinicalTasks() {
    this.storage.get(StorageKeys.HAS_CLINICAL_TASKS).then(isClinical => {
      this.hasClinicalTasks = isClinical
    })
  }

  displayTaskCalendar() {
    this.firebaseAnalytics.logEvent('click', { button: 'show_task_calendar' })
    this.showCalendar = !this.showCalendar
  }

  openSettingsPage() {
    this.firebaseAnalytics.logEvent('click', { button: 'open_settings' })
    this.navCtrl.push(SettingsPageComponent)
  }

  openClinicalTasksPage() {
    this.firebaseAnalytics.logEvent('click', { button: 'open_clinical_tasks' })
    this.navCtrl.push(ClinicalTasksPageComponent)
  }

  startQuestionnaire(taskCalendarTask: Task) {
    this.firebaseAnalytics.logEvent('click', { button: 'start_questionnaire' })
    // NOTE: User can start questionnaire from task calendar or start button in home.
    const task = taskCalendarTask ? taskCalendarTask : this.nextTask
    if (this.tasksService.isTaskValid(task)) {
      this.startingQuestionnaire = true
      const lang = this.storage.get(StorageKeys.LANGUAGE)
      const nextAssessment = this.tasksService.getAssessment(task)
      Promise.all([lang, nextAssessment]).then(res => {
        const language = res[0].value
        const assessment = res[1]
        const params = {
          title: assessment.name,
          introduction: assessment.startText[language],
          endText: assessment.endText[language],
          questions: assessment.questions,
          associatedTask: task,
          assessment: assessment,
          isLastTask: false
        }

        this.tasks
          .then(tasks => this.tasksService.isLastTask(task, tasks))
          .then(lastTask => (params.isLastTask = lastTask))
          .then(() => {
            if (assessment.showIntroduction) {
              this.navCtrl.push(StartPageComponent, params)
            } else {
              this.navCtrl.push(QuestionsPageComponent, params)
            }
          })
      })
    } else {
      this.showMissedInfo()
    }
  }

  showCredits() {
    this.firebaseAnalytics.logEvent('click', { button: 'show_credits' })
    const buttons = [
      {
        text: this.translate.transform(LocKeys.BTN_OKAY.toString()),
        handler: () => {}
      }
    ]
    this.showAlert({
      title: this.translate.transform(LocKeys.CREDITS_TITLE.toString()),
      message: this.translate.transform(LocKeys.CREDITS_BODY.toString()),
      buttons: buttons
    })
  }

  showMissedInfo() {
    return this.showAlert({
      title: this.translate.transform(
        LocKeys.CALENDAR_ESM_MISSED_TITLE.toString()
      ),
      message: this.translate.transform(
        LocKeys.CALENDAR_ESM_MISSED_DESC.toString()
      ),
      buttons: [
        {
          text: this.translate.transform(LocKeys.BTN_OKAY.toString()),
          handler: () => {}
        }
      ]
    })
  }

  showAlert(parameters) {
    const alert = this.alertCtrl.create({
      title: parameters.title,
      buttons: parameters.buttons
    })
    if (parameters.message) {
      alert.setMessage(parameters.message)
    }
    if (parameters.inputs) {
      for (let i = 0; i < parameters.inputs.length; i++) {
        alert.addInput(parameters.inputs[i])
      }
    }
    alert.present()
  }
}
