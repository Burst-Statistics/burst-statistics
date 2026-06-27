<?php

namespace Burst\Admin\Data_Sharing\Data_Collectors;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Ai_Chat_Data
 */
class Ai_Chat_Data extends Data_Collector {

	/**
	 * Collect data from AI chat questions
	 *
	 * @return array{question_count: int, questions: array<int, array{text: string, timestamp: int, model: string|null, answered: bool|null}>}
	 */
	public function collect_data(): array {
		$questions = get_option( 'burst_ai_chat_questions', [] );
		if ( ! is_array( $questions ) ) {
			$questions = [];
		}

		$formatted_questions = [];
		foreach ( $questions as $q ) {
			if ( ! is_array( $q ) || ! isset( $q['text'], $q['timestamp'] ) ) {
				continue;
			}
			$formatted_questions[] = [
				'text'      => (string) $q['text'],
				'timestamp' => (int) $q['timestamp'],
				'model'     => isset( $q['model'] ) ? (string) $q['model'] : null,
				'answered'  => isset( $q['answered'] ) ? (bool) $q['answered'] : null,
			];
		}

		return [
			'question_count' => count( $formatted_questions ),
			'questions'      => $formatted_questions,
		];
	}
}
