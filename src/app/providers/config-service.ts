import 'rxjs/add/operator/toPromise'

import { HttpClient, HttpHeaders } from '@angular/common/http'
import { Injectable } from '@angular/core'

import {
  DefaultNumberOfNotificationsToSchedule,
  DefaultProtocolEndPoint
} from '../../assets/data/defaultConfig'
import { HomeController } from '../providers/home-controller'
import { SchedulingService } from '../providers/scheduling-service'
import { StorageService } from '../providers/storage-service'
import { StorageKeys } from '../shared/enums/storage'

@Injectable()
export class ConfigService {
  URI_PROTOCOL = '/protocol.json'
  URI_QUESTIONNAIRETYPE = '_armt'
  URI_QUESTIONNAIREFORMAT = '.json'

  constructor(
    public http: HttpClient,
    public storage: StorageService,
    private schedule: SchedulingService,
    private controller: HomeController
  ) {}

  fetchConfigState(force: boolean) {
    return Promise.all([
      this.storage.get(StorageKeys.CONFIG_VERSION),
      this.storage.get(StorageKeys.SCHEDULE_VERSION)
    ]).then(([configVersion, scheduleVersion]) => {
      return this.pullProtocol()
        .then(res => {
          const response: any = JSON.parse(res)
          if (
            configVersion !== response.version ||
            scheduleVersion !== response.version ||
            force
          ) {
            this.storage.set(StorageKeys.HAS_CLINICAL_TASKS, false)
            const protocolFormated = this.formatPulledProcotol(
              response.protocols
            )
            const scheduledAssessments = []
            const clinicalAssessments = []
            for (let i = 0; i < protocolFormated.length; i++) {
              const clinical =
                protocolFormated[i]['protocol']['clinicalProtocol']
              if (clinical) {
                this.storage.set(StorageKeys.HAS_CLINICAL_TASKS, true)
                clinicalAssessments.push(protocolFormated[i])
              } else {
                scheduledAssessments.push(protocolFormated[i])
              }
            }
            this.storage.set(StorageKeys.CONFIG_VERSION, response.version)
            return this.storage
              .set(StorageKeys.CONFIG_CLINICAL_ASSESSMENTS, clinicalAssessments)
              .then(() => {
                console.log('Pulled clinical questionnaire')
                return this.pullQuestionnaires(
                  StorageKeys.CONFIG_CLINICAL_ASSESSMENTS
                )
              })
              .then(() => {
                return this.storage
                  .set(StorageKeys.CONFIG_ASSESSMENTS, scheduledAssessments)
                  .then(() => {
                    console.log('Pulled questionnaire')
                    return this.pullQuestionnaires(
                      StorageKeys.CONFIG_ASSESSMENTS
                    )
                  })
              })
              .then(() => {
                return this.controller.cancelNotifications().then(() => {
                  // set notificaition here too so scheduled everytime the schedule changes too.
                  return this.controller
                    .setNextXNotifications(
                      DefaultNumberOfNotificationsToSchedule
                    )
                    .then(() =>
                      console.log('NOTIFICATIONS scheduled after config change')
                    )
                })
              })
          } else {
            console.log(
              'NO CONFIG UPDATE. Version of protocol.json has not changed.'
            )
            return this.schedule.generateSchedule(false)
          }
        })
        .catch(e => console.log(e))
    })
  }

  pullProtocol() {
    return this.getProjectName().then(projectName => {
      if (projectName) {
        const URI = DefaultProtocolEndPoint + projectName + this.URI_PROTOCOL
        return this.http.get(URI, { responseType: 'text' }).toPromise()
      } else {
        console.error(
          'Unknown project name : ' + projectName + '. Cannot pull protocols.'
        )
      }
    })
  }

  getProjectName() {
    return this.storage.get(StorageKeys.PROJECTNAME)
  }

  formatPulledProcotol(protocols) {
    const protocolsFormated = protocols
    for (let i = 0; i < protocolsFormated.length; i++) {
      protocolsFormated[i].questionnaire['type'] = this.URI_QUESTIONNAIRETYPE
      protocolsFormated[i].questionnaire[
        'format'
      ] = this.URI_QUESTIONNAIREFORMAT
    }
    return protocolsFormated
  }

  retrieveLanguageKeys(questionnaireURI) {
    const langs = []
    for (const key in questionnaireURI) {
      if (key) {
        langs.push(key)
      }
    }
    const langsKeyValEmpty = {}
    for (const val of langs) {
      langsKeyValEmpty[val] = ''
    }
    return langsKeyValEmpty
  }

  pullQuestionnaires(storageKey) {
    const assessments = this.storage.get(storageKey)
    const lang = this.storage.get(StorageKeys.LANGUAGE)
    return Promise.all([assessments, lang]).then(vars => {
      const assessmentsResult = vars[0]
      const langResult = vars[1]

      const promises = []
      for (let i = 0; i < assessmentsResult.length; i++) {
        promises.push(
          this.pullQuestionnaireLang(assessmentsResult[i], langResult)
        )
      }
      return Promise.all(promises).then(res => {
        const assessmentUpdate = assessmentsResult
        for (let i = 0; i < assessmentsResult.length; i++) {
          assessmentUpdate[i]['questions'] = this.formatQuestionsHeaders(res[i])
        }
        return this.storage.set(storageKey, assessmentUpdate).then(() => {
          return this.schedule.generateSchedule(true)
        })
      })
    })
  }

  pullQuestionnaireLang(assessment, lang) {
    const uri = this.formatQuestionnaireUri(
      assessment.questionnaire,
      lang.value
    )
    return this.getQuestionnairesOfLang(uri).catch(e => {
      const URI = this.formatQuestionnaireUri(assessment.questionnaire, '')
      return this.getQuestionnairesOfLang(URI)
    })
  }

  formatQuestionnaireUri(questionnaireRepo, langVal) {
    let uri = questionnaireRepo.repository + questionnaireRepo.name + '/'
    uri += questionnaireRepo.name + questionnaireRepo.type
    if (langVal !== '') {
      uri += '_' + langVal
    }
    uri += questionnaireRepo.format
    console.log(uri)
    return uri
  }

  getQuestionnairesOfLang(URI) {
    return this.http.get(URI).toPromise()
  }

  formatQuestionsHeaders(questions) {
    const questionsFormated = questions
    let sectionHeader = questionsFormated[0].section_header
    for (let i = 0; i < questionsFormated.length; i++) {
      if (questionsFormated[i].section_header === '') {
        questionsFormated[i].section_header = sectionHeader
      } else {
        sectionHeader = questionsFormated[i].section_header
      }
    }
    return questionsFormated
  }

  migrateToLatestVersion() {
    // migrate ENROLMENTDATE (from V0.3.1- to V0.3.2+)
    const enrolmentDate = this.storage.get(StorageKeys.ENROLMENTDATE)
    const referenceDate = this.storage.get(StorageKeys.REFERENCEDATE)
    Promise.all([enrolmentDate, referenceDate]).then(dates => {
      if (dates[0] === undefined) {
        this.storage.set(StorageKeys.ENROLMENTDATE, referenceDate)
      }
    })
  }
}