
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ClipboardList,
  Save,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import {
  SURVEY_QUESTIONS,
  SURVEY_SECTIONS,
  getQuestionsBySection,
  initializeSurveyAnswers,
  validateSurveyAnswers,
  type SurveyQuestion,
  type SurveyAnswer,
} from '@/lib/survey-questions';

interface SurveyQuestionnaireProps {
  onSave?: (answers: SurveyAnswer[]) => void;
  initialAnswers?: SurveyAnswer[];
  readOnly?: boolean;
}

export function SurveyQuestionnaire({
  onSave,
  initialAnswers,
  readOnly = false,
}: SurveyQuestionnaireProps) {
  const [answers, setAnswers] = useState<SurveyAnswer[]>(
    initialAnswers || initializeSurveyAnswers()
  );
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set([SURVEY_SECTIONS.BASIC_INFO])
  );
  const [validation, setValidation] = useState<{
    valid: boolean;
    missingQuestions: string[];
  } | null>(null);

  // 切换章节展开/收起
  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // 更新回答
  const updateAnswer = (questionId: string, value: any) => {
    if (readOnly) return;
    
    setAnswers(prev => {
      const existing = prev.find(a => a.questionId === questionId);
      if (existing) {
        return prev.map(a =>
          a.questionId === questionId ? { ...a, value, timestamp: new Date() } : a
        );
      }
      return [...prev, { questionId, value, timestamp: new Date() }];
    });
    
    // 清除验证状态
    setValidation(null);
  };

  // 获取问题的当前值
  const getAnswerValue = (questionId: string) => {
    const answer = answers.find(a => a.questionId === questionId);
    return answer?.value;
  };

  // 保存回答
  const handleSave = () => {
    const result = validateSurveyAnswers(answers);
    setValidation(result);
    
    if (result.valid) {
      onSave?.(answers);
    }
  };

  // 渲染单个问题
  const renderQuestion = (question: SurveyQuestion) => {
    const value = getAnswerValue(question.id);
    const isMissing = validation?.missingQuestions.includes(question.question);

    return (
      <div key={question.id} className={`space-y-2 p-4 rounded-lg ${isMissing ? 'bg-red-50 border border-red-200' : 'bg-slate-50'}`}>
        <div className="flex items-start gap-2">
          {question.required && (
            <span className="text-red-500 font-medium">*</span>
          )}
          <div className="flex-1">
            <Label htmlFor={question.id} className="font-medium text-slate-900">
              {question.question}
            </Label>
            {question.hint && (
              <p className="text-xs text-slate-500 mt-1">{question.hint}</p>
            )}
          </div>
          {isMissing && (
            <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
              必填
            </Badge>
          )}
        </div>

        {!readOnly ? (
          <>
            {question.type === 'text' && (
              <Input
                id={question.id}
                value={(value as string) || ''}
                onChange={(e) => updateAnswer(question.id, e.target.value)}
                placeholder={question.placeholder}
                className={isMissing ? 'border-red-300 focus:ring-red-500' : ''}
              />
            )}

            {question.type === 'number' && (
              <Input
                id={question.id}
                type="number"
                value={(value as number) || ''}
                onChange={(e) => updateAnswer(question.id, parseFloat(e.target.value) || 0)}
                placeholder={question.placeholder}
                min={question.validation?.min}
                max={question.validation?.max}
                className={isMissing ? 'border-red-300 focus:ring-red-500' : ''}
              />
            )}

            {question.type === 'date' && (
              <Input
                id={question.id}
                type="date"
                value={value ? new Date(value as string).toISOString().split('T')[0] : ''}
                onChange={(e) => updateAnswer(question.id, e.target.value)}
                className={isMissing ? 'border-red-300 focus:ring-red-500' : ''}
              />
            )}

            {question.type === 'boolean' && (
              <div className="flex items-center gap-3">
                <Switch
                  id={question.id}
                  checked={value as boolean}
                  onCheckedChange={(checked) => updateAnswer(question.id, checked)}
                />
                <Label htmlFor={question.id} className="text-sm">
                  {(value as boolean) ? '是' : '否'}
                </Label>
              </div>
            )}

            {question.type === 'select' && question.options && (
              <Select
                value={(value as string) || ''}
                onValueChange={(val) => updateAnswer(question.id, val)}
              >
                <SelectTrigger
                  id={question.id}
                  className={isMissing ? 'border-red-300 focus:ring-red-500' : ''}
                >
                  <SelectValue placeholder={question.placeholder || '请选择'} />
                </SelectTrigger>
                <SelectContent>
                  {question.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {question.type === 'multiselect' && question.options && (
              <div className="space-y-2">
                {question.options.map((option) => (
                  <div key={option.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`${question.id}-${option.value}`}
                      checked={(value as string[])?.includes(option.value)}
                      onCheckedChange={(checked) => {
                        const current = (value as string[]) || [];
                        if (checked) {
                          updateAnswer(question.id, [...current, option.value]);
                        } else {
                          updateAnswer(question.id, current.filter(v => v !== option.value));
                        }
                      }}
                    />
                    <Label htmlFor={`${question.id}-${option.value}`}>
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            )}

            {question.type === 'textarea' && (
              <Textarea
                id={question.id}
                value={(value as string) || ''}
                onChange={(e) => updateAnswer(question.id, e.target.value)}
                placeholder={question.placeholder}
                rows={4}
                className={isMissing ? 'border-red-300 focus:ring-red-500' : ''}
              />
            )}
          </>
        ) : (
          // 只读模式
          <div className="text-slate-700 bg-white p-3 rounded border">
            {question.type === 'boolean' ? (
              <span>{(value as boolean) ? '是' : '否'}</span>
            ) : question.type === 'multiselect' ? (
              <div className="flex flex-wrap gap-2">
                {(value as string[])?.map(v => (
                  <Badge key={v} variant="outline">{v}</Badge>
                ))}
              </div>
            ) : (
              <span>{(value as string) || '-'}</span>
            )}
          </div>
        )}
      </div>
    );
  };

  const questionsBySection = getQuestionsBySection();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-blue-600" />
            查勘问询信息记录
          </h2>
          <p className="text-slate-500 mt-1">
            维保查勘现场问询信息采集
          </p>
        </div>
        {!readOnly && (
          <Button 
            onClick={handleSave}
            className="bg-blue-700 hover:bg-blue-800"
          >
            <Save className="h-4 w-4 mr-2" />
            保存记录
          </Button>
        )}
      </div>

      {/* 验证状态提示 */}
      {validation && (
        <Card className={validation.valid ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              {validation.valid ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              <div>
                <p className={validation.valid ? 'text-green-800' : 'text-red-800'}>
                  {validation.valid
                    ? '所有必填项已完成！'
                    : `还有 ${validation.missingQuestions.length} 个必填项未填写`}
                </p>
                {!validation.valid && (
                  <p className="text-sm text-red-600 mt-1">
                    未填写：{validation.missingQuestions.join('、')}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 各章节问题 */}
      {Object.entries(questionsBySection).map(([section, questions]) => (
        <Card key={section}>
          <CardHeader 
            className="cursor-pointer pb-3"
            onClick={() => toggleSection(section)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {expandedSections.has(section) ? (
                  <ChevronDown className="h-5 w-5 text-slate-500" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-slate-500" />
                )}
                <CardTitle className="text-lg">{section}</CardTitle>
              </div>
              <Badge variant="outline">
                {questions.filter(q => q.required).length} 项必填
              </Badge>
            </div>
            <CardDescription>
              共 {questions.length} 个问题
            </CardDescription>
          </CardHeader>
          
          {expandedSections.has(section) && (
            <CardContent className="space-y-4 pt-0">
              <Separator className="mb-4" />
              {questions.map(question => renderQuestion(question))}
            </CardContent>
          )}
        </Card>
      ))}

      {!readOnly && (
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setAnswers(initializeSurveyAnswers());
              setValidation(null);
            }}
          >
            重置
          </Button>
          <Button
            onClick={handleSave}
            className="bg-blue-700 hover:bg-blue-800"
          >
            <Save className="h-4 w-4 mr-2" />
            保存查勘记录
          </Button>
        </div>
      )}
    </div>
  );
}

